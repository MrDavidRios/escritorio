-- Idiom of the day: a global (not per-user) list of Spanish idioms and sayings.
-- The dashboard fetches the list and picks today's idiom client-side
-- (see src/features/idioms/idiomOfTheDay.ts).
--
-- Add more idioms from the Supabase table editor / SQL editor (which bypass
-- RLS); the app itself can only read. Set `featured_on` to pin an idiom to a
-- specific local calendar date; pinned idioms are excluded from the daily
-- rotation and only appear on their date.
--
-- Seed data: idiom choice and meanings follow the corresponding English
-- Wiktionary entries (https://en.wiktionary.org, CC BY-SA 4.0), linked per row
-- in `source_url`. Example sentences are original. Because the meanings derive
-- from Wiktionary, this data is shared under CC BY-SA 4.0 -- see ATTRIBUTIONS.md.

create table public.idioms (
  id uuid primary key default gen_random_uuid(),
  -- Insertion order. The daily rotation is ordered by this, so appending new
  -- idioms never reorders existing ones.
  seq integer generated always as identity,
  spanish text not null unique,
  english text not null,
  example text,
  source_url text not null,
  featured_on date unique,
  created_at timestamptz not null default now()
);

alter table public.idioms enable row level security;

-- Read-only for signed-in users. No insert/update/delete policies: the list is
-- curated by the owner via the dashboard / SQL editor, never by clients.
create policy "idioms_select_authenticated"
  on public.idioms for select
  to authenticated
  using (true);

insert into public.idioms (spanish, english, example, source_url) values
  ('costar un ojo de la cara', 'to cost a fortune (literally: to cost an eye of the face)', 'Ese reloj cuesta un ojo de la cara.', 'https://en.wiktionary.org/wiki/costar_un_ojo_de_la_cara#Spanish'),
  ('meter la pata', 'to put one''s foot in it; to make a blunder', 'Metí la pata al mencionar la sorpresa delante de ella.', 'https://en.wiktionary.org/wiki/meter_la_pata#Spanish'),
  ('no tener pelos en la lengua', 'to not mince words; to speak one''s mind', 'Mi abuela no tiene pelos en la lengua.', 'https://en.wiktionary.org/wiki/no_tener_pelos_en_la_lengua#Spanish'),
  ('ponerse las pilas', 'to get one''s act together; to get moving (literally: to put in the batteries)', 'Si quieres aprobar, tienes que ponerte las pilas.', 'https://en.wiktionary.org/wiki/ponerse_las_pilas#Spanish'),
  ('tomar el pelo', 'to pull someone''s leg; to kid or tease someone', '¿Me estás tomando el pelo?', 'https://en.wiktionary.org/wiki/tomar_el_pelo#Spanish'),
  ('dar la lata', 'to annoy; to be a pest', 'Deja de dar la lata con la misma pregunta.', 'https://en.wiktionary.org/wiki/dar_la_lata#Spanish'),
  ('a buen entendedor, pocas palabras bastan', 'a word to the wise is enough', 'No hace falta que lo repitas: a buen entendedor, pocas palabras bastan.', 'https://en.wiktionary.org/wiki/a_buen_entendedor,_pocas_palabras_bastan#Spanish'),
  ('echar una mano', 'to lend a hand', '¿Me echas una mano con las maletas?', 'https://en.wiktionary.org/wiki/echar_una_mano#Spanish'),
  ('hablar por los codos', 'to talk nonstop (literally: to talk through the elbows)', 'Mi hermana habla por los codos cuando está nerviosa.', 'https://en.wiktionary.org/wiki/hablar_por_los_codos#Spanish'),
  ('ser uña y carne', 'to be inseparable (literally: to be fingernail and flesh)', 'Ana y Lucía son uña y carne desde niñas.', 'https://en.wiktionary.org/wiki/ser_u%C3%B1a_y_carne#Spanish'),
  ('tirar la casa por la ventana', 'to spare no expense; to splurge (literally: to throw the house out the window)', 'Para la boda tiraron la casa por la ventana.', 'https://en.wiktionary.org/wiki/tirar_la_casa_por_la_ventana#Spanish'),
  ('no dar pie con bola', 'to keep getting things wrong; to be off one''s game', 'Hoy no doy pie con bola; me equivoco en todo.', 'https://en.wiktionary.org/wiki/no_dar_pie_con_bola#Spanish'),
  ('dar en el clavo', 'to hit the nail on the head', 'Con tu respuesta diste en el clavo.', 'https://en.wiktionary.org/wiki/dar_en_el_clavo#Spanish'),
  ('llover a cántaros', 'to rain cats and dogs; to pour', 'Salimos sin paraguas y empezó a llover a cántaros.', 'https://en.wiktionary.org/wiki/llover_a_c%C3%A1ntaros#Spanish'),
  ('ponerse las botas', 'to have a great feast; to gorge oneself (also: to make a killing)', 'En la boda nos pusimos las botas con el jamón.', 'https://en.wiktionary.org/wiki/ponerse_las_botas#Spanish'),
  ('de pe a pa', 'from start to finish; completely (literally: from P to P, from "pe" to "pa")', 'Me sé la canción de pe a pa.', 'https://en.wiktionary.org/wiki/de_pe_a_pa#Spanish'),
  ('en un abrir y cerrar de ojos', 'in the blink of an eye', 'El verano pasó en un abrir y cerrar de ojos.', 'https://en.wiktionary.org/wiki/en_un_abrir_y_cerrar_de_ojos#Spanish'),
  ('cada loco con su tema', 'each to their own', 'A él le gusta el jazz y a mí la ópera: cada loco con su tema.', 'https://en.wiktionary.org/wiki/cada_loco_con_su_tema#Spanish'),
  ('dar calabazas', 'to turn someone down; to jilt or snub (literally: to give pumpkins)', 'Le pidió una cita y ella le dio calabazas.', 'https://en.wiktionary.org/wiki/dar_calabazas#Spanish'),
  ('estar en Babia', 'to have one''s head in the clouds; to be absent-minded', 'Perdona, estaba en Babia. ¿Qué decías?', 'https://en.wiktionary.org/wiki/estar_en_Babia#Spanish'),
  ('pagar el pato', 'to take the blame; to bear the brunt (literally: to pay for the duck)', 'Yo no hice nada, pero siempre pago el pato.', 'https://en.wiktionary.org/wiki/pagar_el_pato#Spanish'),
  ('hacer de tripas corazón', 'to pull oneself together; to put on a brave face', 'Hizo de tripas corazón y dio el discurso.', 'https://en.wiktionary.org/wiki/hacer_de_tripas_coraz%C3%B3n#Spanish'),
  ('a otra cosa, mariposa', 'let''s change the subject; on to the next thing (literally: on to something else, butterfly)', 'Ya hablamos bastante del examen: a otra cosa, mariposa.', 'https://en.wiktionary.org/wiki/a_otra_cosa,_mariposa#Spanish'),
  ('no hay mal que por bien no venga', 'every cloud has a silver lining; a blessing in disguise', 'Perdí el tren, pero conocí a alguien: no hay mal que por bien no venga.', 'https://en.wiktionary.org/wiki/no_hay_mal_que_por_bien_no_venga#Spanish'),
  ('pan comido', 'a piece of cake; something very easy (literally: eaten bread)', 'El examen fue pan comido.', 'https://en.wiktionary.org/wiki/pan_comido#Spanish'),
  ('ahogarse en un vaso de agua', 'to make a mountain out of a molehill (literally: to drown in a glass of water)', 'Cálmate, te ahogas en un vaso de agua.', 'https://en.wiktionary.org/wiki/ahogarse_en_un_vaso_de_agua#Spanish'),
  ('poner los puntos sobre las íes', 'to dot the i''s; to spell things out precisely', 'Antes de firmar, pongamos los puntos sobre las íes.', 'https://en.wiktionary.org/wiki/poner_los_puntos_sobre_las_%C3%ADes#Spanish'),
  ('dar gato por liebre', 'to pass off something inferior as something better; to con someone (literally: to give cat for hare)', 'Me vendieron una copia y me dieron gato por liebre.', 'https://en.wiktionary.org/wiki/dar_gato_por_liebre#Spanish'),
  ('más vale tarde que nunca', 'better late than never', 'Llegaste tarde, pero más vale tarde que nunca.', 'https://en.wiktionary.org/wiki/m%C3%A1s_vale_tarde_que_nunca#Spanish'),
  ('con las manos en la masa', 'red-handed; caught in the act (literally: with one''s hands in the dough)', 'La policía lo pilló con las manos en la masa.', 'https://en.wiktionary.org/wiki/con_las_manos_en_la_masa#Spanish');
