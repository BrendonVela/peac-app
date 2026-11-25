-- PEAC: split "A + B" exercises in existing programs into separate exercises done as a superset.
-- Safe to run more than once. Rows an athlete already logged are left as they are.
do $$
declare
  m jsonb := '{"90/90 Pelvic Mobility + Hip-Shoulder Sep Drill": ["90/90 Pelvic Mobility", "Hip-Shoulder Sep Drill"], "Ab Wheel + Pallof": ["Ab Wheel", "Pallof"], "Ab Wheel + Pallof Press": ["Ab Wheel", "Pallof Press"], "Ankle Rocker + Couch Stretch (paired)": ["Ankle Rocker", "Couch Stretch"], "Band ER (side) + Prone Y Raise — Superset": ["Band ER (side)", "Prone Y Raise"], "Band ER + Prone Y": ["Band ER", "Prone Y"], "Band ER + Prone Y-T Superset": ["Band ER", "Prone Y-T"], "Band ER + Prone Y-T-W": ["Band ER", "Prone Y-T-W"], "Band ER @ 90/90 + Prone T": ["Band ER @ 90/90", "Prone T"], "Band ER @ 90/90 + Prone Y": ["Band ER @ 90/90", "Prone Y"], "Band ER @ 90/90 + Prone Y-T": ["Band ER @ 90/90", "Prone Y-T"], "Band ER @ 90° + Prone Y-T-W": ["Band ER @ 90°", "Prone Y-T-W"], "Band ER @ 90° Iso Hold + Prone Y-T-W": ["Band ER @ 90° Iso Hold", "Prone Y-T-W"], "Band ER Iso Hold @ 90/90 + Prone Y": ["Band ER Iso Hold @ 90/90", "Prone Y"], "Band ER/IR 90/90 + Pull-Apart": ["Band ER/IR 90/90", "Pull-Apart"], "Band ER/IR @ 0° + Cross-Body Stretch": ["Band ER/IR @ 0°", "Cross-Body Stretch"], "Band ER/IR @ 90° + Prone Y-T-W": ["Band ER/IR @ 90°", "Prone Y-T-W"], "Band External Rotation + Prone Y": ["Band External Rotation", "Prone Y"], "Band Face Pull w/ ER + DB Hammer Curl": ["Band Face Pull w/ ER", "DB Hammer Curl"], "Band Pull-Apart + Prone Y": ["Band Pull-Apart", "Prone Y"], "Band Y-Raise + Band Face Pull (superset)": ["Band Y-Raise", "Band Face Pull"], "Bench Lat + Thoracic Sink": ["Bench Lat", "Thoracic Sink"], "Cat-Cow + Quadruped Hip Extension": ["Cat-Cow", "Quadruped Hip Extension"], "Chest-Supported DB Shrug + Y-Raise": ["Chest-Supported DB Shrug", "Y-Raise"], "Copenhagen + Nordic": ["Copenhagen", "Nordic"], "Copenhagen + Side Plank Row": ["Copenhagen", "Side Plank Row"], "Couch Stretch + 90/90 Hold": ["Couch Stretch", "90/90 Hold"], "DB Hammer Curl + Band Pressdown (superset)": ["DB Hammer Curl", "Band Pressdown"], "DB Hammer Curl + Rope Pushdown (superset)": ["DB Hammer Curl", "Rope Pushdown"], "DB Lateral Raise + Rear Delt Fly": ["DB Lateral Raise", "Rear Delt Fly"], "Face Pull + Band ER": ["Face Pull", "Band ER"], "Face Pull + Band ER + Prone Y": ["Face Pull", "Band ER", "Prone Y"], "Face Pull + Band Pull-Apart": ["Face Pull", "Band Pull-Apart"], "Forearm/Wrist Roller + Finger Extensions": ["Forearm/Wrist Roller", "Finger Extensions"], "Hammer Curl + Overhead Triceps": ["Hammer Curl", "Overhead Triceps"], "Hammer Curl + Overhead Triceps Ext.": ["Hammer Curl", "Overhead Triceps Ext."], "Hammer Curl + Triceps Extension": ["Hammer Curl", "Triceps Extension"], "Hurdle Hop + Sprint 10yd": ["Hurdle Hop", "Sprint 10yd"], "Landmine Press + Face Pull": ["Landmine Press", "Face Pull"], "Landmine Rotation + Copenhagen": ["Landmine Rotation", "Copenhagen"], "Lat Stretch + Pec Doorway Stretch": ["Lat Stretch", "Pec Doorway Stretch"], "Nordic + Copenhagen": ["Nordic", "Copenhagen"], "Pallof + Side Plank": ["Pallof", "Side Plank"], "Pallof Press + Side Plank": ["Pallof Press", "Side Plank"], "Prone Y-Holds + Banded Over & Backs": ["Prone Y-Holds", "Banded Over & Backs"], "Prone Y-T-W + Sleeper Stretch": ["Prone Y-T-W", "Sleeper Stretch"], "SL RDL + Suitcase Carry": ["SL RDL", "Suitcase Carry"], "Side Plank Row + Hollow Hold": ["Side Plank Row", "Hollow Hold"], "Side Plank Row + Pallof": ["Side Plank Row", "Pallof"], "Sled Push 20 yd + Backward Drag 20 yd": ["Sled Push 20 yd", "Backward Drag 20 yd"], "Sleeper Stretch + Cross-Body Stretch": ["Sleeper Stretch", "Cross-Body Stretch"], "Standing Calf Raise + Tib Raise": ["Standing Calf Raise", "Tib Raise"], "Standing Calf Raise + Tibialis Raise": ["Standing Calf Raise", "Tibialis Raise"], "Suitcase Carry + Side Plank": ["Suitcase Carry", "Side Plank"], "T-Spine Open Book + Thread the Needle": ["T-Spine Open Book", "Thread the Needle"], "Tib Raise + Calf Raise off a Plate (3-sec ecc)": ["Tib Raise", "Calf Raise off a Plate (3-sec ecc)"]}'::jsonb;
  r record;
  wx record;
  ex_ids uuid[];
  pid uuid;
  k int;
  n int;
  used text[];
  letter text;
begin
  for r in select e.id, e.title, e.category, e.video_url from exercises e where m ? e.title loop
    -- the separate exercises (reuse ones already in the library, with a video if possible)
    ex_ids := '{}';
    for k in 0 .. jsonb_array_length(m -> r.title) - 1 loop
      pid := null;
      select id into pid from exercises
        where lower(trim(title)) = lower(m -> r.title ->> k)
        order by (video_url is not null) desc limit 1;
      if pid is null then
        insert into exercises (title, category) values (m -> r.title ->> k, r.category) returning id into pid;
      end if;
      ex_ids := ex_ids || pid;
    end loop;
    n := array_length(ex_ids, 1);

    for wx in select * from workout_exercises where exercise_id = r.id loop
      if exists (select 1 from workout_results where workout_exercise_id = wx.id) then continue; end if;
      -- next superset letter not used in that workout
      select coalesce(array_agg(upper((regexp_match(section, '(?:superset|complex|circuit)\s+([a-z])\M', 'i'))[1])), '{}')
        into used from workout_exercises
        where workout_id = wx.workout_id and section ~* '(superset|complex|circuit)\s+[a-z]\M';
      select c into letter from unnest(string_to_array('A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z', ',')) with ordinality as t(c, i)
        where not (c = any(used)) order by i limit 1;
      letter := coalesce(letter, 'Z');
      -- make room, then put the separate exercises where the combined one was
      update workout_exercises set "order" = "order" + n - 1
        where workout_id = wx.workout_id and "order" > coalesce(wx."order", 0);
      for k in 1 .. n loop
        insert into workout_exercises
        select * from jsonb_populate_record(null::workout_exercises,
          to_jsonb(wx) || jsonb_build_object(
            'id', gen_random_uuid(),
            'exercise_id', ex_ids[k],
            'order', coalesce(wx."order", 0) + k - 1,
            'section', case
              -- already part of a superset/circuit: the separate exercises just join it
              when wx.section ~* '(superset|super set|complex|circuit|tri-?set|giant set)' then wx.section
              else coalesce(nullif(trim(wx.section), '') || ' · ', '') || 'Superset ' || letter end));
      end loop;
      delete from workout_exercises where id = wx.id;
    end loop;

    -- drop the combined exercise from the library once nothing uses it
    if r.video_url is null and not exists (select 1 from workout_exercises where exercise_id = r.id) then
      begin
        delete from exercises where id = r.id;
      exception when others then null;
      end;
    end if;
  end loop;
end $$;

-- What's left combined (only rows athletes already logged, plus names that really are one exercise)
select e.title, count(*) as still_combined
from workout_exercises wx join exercises e on e.id = wx.exercise_id
where e.title like '% + %'
group by e.title order by e.title;
