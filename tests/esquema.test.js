/**
 * Ché boluda — pruebas de la migración de Supabase sobre PGlite.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Se ejecuta la migración real contra un Postgres en WASM con un esqueleto de
 * Supabase (tests/sql/stub-supabase.sql) y se prueban las reglas de seguridad
 * como lo haría cada usuario: con el rol authenticated y su uid en el JWT.
 */
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const raiz = new URL('../', import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, raiz), 'utf8');

let db;
const uid = {};

/** Ejecuta `fn` como el usuario `nombre` (o como anon si es null). */
async function como(nombre, fn, { tema = '' } = {}) {
  const rol = nombre ? 'authenticated' : 'anon';
  const sub = nombre ? uid[nombre] : '';
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('realtime.topic', $2, false)`, [sub, tema]);
  await db.exec(`set role ${rol}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
  }
}

const filas = async (sql, params) => (await db.query(sql, params)).rows;

async function registrar(usuario, nombre) {
  const [{ id }] = await filas(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${usuario}@usuarios.cheboluda.app`, { usuario, nombre, avatar: '🌸' }]
  );
  uid[usuario] = id;
  return id;
}

before(async () => {
  db = new PGlite();
  await db.exec(leer('tests/sql/stub-supabase.sql'));
  for (const archivo of readdirSync(new URL('supabase/migrations/', raiz)).sort()) {
    await db.exec(leer(`supabase/migrations/${archivo}`));
  }
  await registrar('lucia', 'Lucía');
  await registrar('marta', 'Marta');
  await registrar('extrana', 'Desconocida');
});

test('registrarse crea perfil y código de invitación', async () => {
  const [perfil] = await filas(`select usuario, nombre, avatar from public.perfiles where id = $1`, [uid.lucia]);
  assert.deepEqual(perfil, { usuario: 'lucia', nombre: 'Lucía', avatar: '🌸' });
  const [{ codigo }] = await filas(`select codigo from public.codigos where perfil_id = $1`, [uid.lucia]);
  assert.match(codigo, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
});

test('un usuario con formato inválido no llega a crearse', async () => {
  await assert.rejects(
    filas(`insert into auth.users (email, raw_user_meta_data) values ('x@y.z', '{"usuario":"Con Espacios"}')`),
    /perfiles_usuario_check/
  );
});

test('los códigos generados no se repiten', async () => {
  const rows = await filas(`select count(distinct public.nuevo_codigo()) as n from generate_series(1, 2000)`);
  assert.equal(Number(rows[0].n), 2000);
});

test('anon solo puede ver la invitación y comprobar usuarios', async () => {
  const [{ codigo }] = await filas(`select codigo from public.codigos where perfil_id = $1`, [uid.lucia]);
  await como(null, async () => {
    const [inv] = await filas(`select * from public.ver_invitacion($1)`, [codigo.toLowerCase()]);
    assert.equal(inv.nombre, 'Lucía');
    assert.equal((await filas(`select public.usuario_disponible('LUCIA') as libre`))[0].libre, false);
    assert.equal((await filas(`select public.usuario_disponible('nadie') as libre`))[0].libre, true);
    await assert.rejects(filas(`select * from public.perfiles`), /permission denied/);
    await assert.rejects(filas(`select public.aceptar_invitacion($1)`, [codigo]), /permission denied/);
  });
});

test('antes de ser amigas no se ven los perfiles ni los códigos ajenos', async () => {
  await como('marta', async () => {
    const visibles = await filas(`select usuario from public.perfiles order by usuario`);
    assert.deepEqual(visibles.map((f) => f.usuario), ['marta']);
    assert.equal((await filas(`select * from public.codigos`)).length, 1);
  });
});

test('aceptar invitación crea la amistad para las dos', async () => {
  const [{ codigo }] = await filas(`select codigo from public.codigos where perfil_id = $1`, [uid.lucia]);
  await como('marta', async () => {
    await assert.rejects(filas(`select * from public.aceptar_invitacion('ZZZZZZZZ')`), /Invitación no válida/);
    const [amiga] = await filas(`select * from public.aceptar_invitacion($1)`, [codigo]);
    assert.equal(amiga.usuario, 'lucia');
    // Aceptarla dos veces no duplica nada.
    await filas(`select * from public.aceptar_invitacion($1)`, [codigo]);
    assert.equal((await filas(`select * from public.amistades`)).length, 1);
    assert.deepEqual((await filas(`select usuario from public.perfiles order by usuario`)).map((f) => f.usuario), ['lucia', 'marta']);
    assert.equal((await filas(`select * from public.codigos`)).length, 1, 'el código de Lucía sigue oculto');
  });
  await como('lucia', async () => {
    await assert.rejects(filas(`select * from public.aceptar_invitacion($1)`, [codigo]), /propia invitación/);
    assert.equal((await filas(`select * from public.amistades`)).length, 1);
  });
});

test('el perfil propio se edita, pero el usuario no', async () => {
  await como('lucia', async () => {
    await filas(`update public.perfiles set nombre = 'Lu', avatar = '🦋' where id = $1`, [uid.lucia]);
    await assert.rejects(filas(`update public.perfiles set usuario = 'otra' where id = $1`, [uid.lucia]), /permission denied/);
    const [p] = await filas(`update public.perfiles set nombre = 'Hackeada' where id = $1 returning id`, [uid.marta]);
    assert.equal(p, undefined, 'no puede tocar el perfil de Marta');
  });
  await como('lucia', async () => {
    const nuevo = (await filas(`select public.regenerar_codigo() as c`))[0].c;
    assert.match(nuevo, /^[A-Z2-9]{8}$/);
  });
});

let grupo;
let directo;

test('salas: solo con amigos, y la extraña no ve nada', async () => {
  await como('lucia', async () => {
    await assert.rejects(
      filas(`select public.crear_sala('Mal', '🔥', $1::uuid[])`, [[uid.extrana]]),
      /Solo puedes añadir a tus amigos/
    );
    grupo = (await filas(`select public.crear_sala(' Las chicas ', '💅', $1::uuid[]) as id`, [[uid.marta, uid.marta]]))[0].id;
    await assert.rejects(filas(`select public.abrir_directo($1)`, [uid.extrana]), /Solo puedes hablar con tus amigos/);
    directo = (await filas(`select public.abrir_directo($1) as id`, [uid.marta]))[0].id;
  });
  await como('marta', async () => {
    const otraVez = (await filas(`select public.abrir_directo($1) as id`, [uid.lucia]))[0].id;
    assert.equal(otraVez, directo, 'el directo es el mismo para las dos');
    const salas = await filas(`select * from public.listar_salas()`);
    assert.equal(salas.length, 2);
    const g = salas.find((s) => s.id === grupo);
    assert.equal(g.nombre, 'Las chicas');
    assert.equal(g.miembros.length, 2);
  });
  await como('extrana', async () => {
    assert.equal((await filas(`select * from public.salas`)).length, 0);
    assert.equal((await filas(`select * from public.listar_salas()`)).length, 0);
    await assert.rejects(filas(`select public.anadir_miembros($1, $2::uuid[])`, [grupo, [uid.extrana]]), /No estás en esa sala/);
  });
});

test('mensajes: solo miembros, con su autoría y en la carpeta de la sala', async () => {
  const insertar = (sala, autor, ruta) =>
    filas(`insert into public.mensajes (sala_id, autor_id, audio, duracion_ms, onda) values ($1, $2, $3, 1500, '{10,50,100}') returning id`, [sala, autor, ruta]);

  await como('lucia', async () => {
    await insertar(grupo, uid.lucia, `${grupo}/uno.cba`);
    await assert.rejects(insertar(grupo, uid.marta, `${grupo}/dos.cba`), /row-level security/);
    await assert.rejects(insertar(grupo, uid.lucia, `${directo}/tres.cba`), /row-level security/);
  });
  await como('extrana', async () => {
    await assert.rejects(insertar(grupo, uid.extrana, `${grupo}/cuatro.cba`), /row-level security/);
    assert.equal((await filas(`select * from public.mensajes`)).length, 0);
  });
  await como('marta', async () => {
    const [g] = (await filas(`select * from public.listar_salas()`)).filter((s) => s.id === grupo);
    assert.equal(g.no_leidos, 1);
    assert.equal(g.ultimo.duracion_ms, 1500);
    await filas(`select public.marcar_leido($1)`, [grupo]);
    const [despues] = (await filas(`select * from public.listar_salas()`)).filter((s) => s.id === grupo);
    assert.equal(despues.no_leidos, 0);
  });
  await como('lucia', async () => {
    const [g] = (await filas(`select * from public.listar_salas()`)).filter((s) => s.id === grupo);
    assert.equal(g.no_leidos, 0, 'lo propio no cuenta como pendiente');
  });
});

test('storage: audios por sala y avatares por carpeta propia', async () => {
  const subir = (bucket, nombre) => filas(`insert into storage.objects (bucket_id, name) values ($1, $2) returning id`, [bucket, nombre]);
  await como('marta', async () => {
    await subir('audios', `${grupo}/x.cba`);
    await subir('avatares', `${uid.marta}/1.jpg`);
    await assert.rejects(subir('avatares', `${uid.lucia}/1.jpg`), /row-level security/);
    await assert.rejects(subir('audios', `no-es-uuid/x.cba`), /row-level security/);
  });
  await como('extrana', async () => {
    await assert.rejects(subir('audios', `${grupo}/y.cba`), /row-level security/);
    assert.equal((await filas(`select * from storage.objects where bucket_id = 'audios'`)).length, 0);
  });
  await como('lucia', async () => {
    assert.equal((await filas(`select * from storage.objects where bucket_id = 'audios'`)).length, 1);
    const borradas = await filas(`delete from storage.objects where bucket_id = 'audios' returning id`);
    assert.equal(borradas.length, 0, 'no borra el audio que subió Marta');
  });
});

test('realtime: el canal de voz solo admite a los miembros', async () => {
  // Sin RETURNING: con él también se exige la política de lectura y taparía un
  // fallo en la de escritura, que es la que Realtime comprueba al emitir.
  const hablar = () => filas(`insert into realtime.messages (topic, extension) values (realtime.topic(), 'broadcast')`);
  await como('marta', () => hablar(), { tema: `sala:${grupo}` });
  await como('extrana', () => assert.rejects(hablar(), /row-level security/), { tema: `sala:${grupo}` });
  await como('marta', () => assert.rejects(hablar(), /row-level security/), { tema: `otra:${grupo}` });
  await como('extrana', async () => {
    assert.equal((await filas(`select * from realtime.messages`)).length, 0);
  }, { tema: `sala:${grupo}` });
});

test('salir de un grupo sí, de un directo no; borrar amistad', async () => {
  await como('marta', async () => {
    assert.equal((await filas(`delete from public.miembros where sala_id = $1 and perfil_id = $2 returning 1`, [directo, uid.marta])).length, 0);
    assert.equal((await filas(`delete from public.miembros where sala_id = $1 and perfil_id = $2 returning 1`, [grupo, uid.lucia])).length, 0);
    assert.equal((await filas(`delete from public.miembros where sala_id = $1 and perfil_id = $2 returning 1`, [grupo, uid.marta])).length, 1);
    assert.equal((await filas(`select * from public.listar_salas()`)).length, 1);
    await filas(`delete from public.amistades`);
  });
  await como('lucia', async () => {
    assert.equal((await filas(`select * from public.amistades`)).length, 0);
    await assert.rejects(filas(`select public.anadir_miembros($1, $2::uuid[])`, [grupo, [uid.marta]]), /Solo puedes añadir a tus amigos/);
  });
});

test('no_leidos_de es solo para el servidor', async () => {
  await como('lucia', () => assert.rejects(filas(`select * from public.no_leidos_de($1::uuid[])`, [[uid.lucia]]), /permission denied/));
  await db.exec('set role service_role');
  try {
    const [fila] = await filas(`select * from public.no_leidos_de($1::uuid[])`, [[uid.lucia]]);
    assert.equal(fila, undefined, 'Lucía no tiene nada pendiente');
  } finally {
    await db.exec('reset role');
  }
});

test('suscripciones push: el dispositivo pasa a la cuenta que entra', async () => {
  const guardar = () => filas(`select public.guardar_suscripcion('https://web.push.apple.com/abc', 'p', 'a')`);
  await como('lucia', guardar);
  await como('marta', guardar);
  await como('lucia', async () => assert.equal((await filas(`select * from public.suscripciones_push`)).length, 0));
  await como('marta', async () => assert.equal((await filas(`select * from public.suscripciones_push`)).length, 1));
});
