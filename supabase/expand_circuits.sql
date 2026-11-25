-- PEAC: replace named circuits ("Full Arm Care Circuit", "Hip + T-Spine Circuit — see MOBILITY tab", ...)
-- with the real exercises from the plans, grouped as a circuit. Safe to run more than once.
-- Rows an athlete already logged are left as they are.
do $$
declare
  m jsonb := '{"Full Arm Care Circuit": ["Band Resisted External Rotation", "Band Resisted Internal Rotation", "Prone Y-T-W"], "Full Arm Care Circuit (ER, IR, Y, T, W)": ["Band Resisted External Rotation", "Band Resisted Internal Rotation", "Prone Y-T-W"], "Full Arm Care Circuit + Forearm Work": ["Band Resisted External Rotation", "Band Resisted Internal Rotation", "Prone Y-T-W", "Forearm/Wrist Roller", "DB Pronation / Supination"], "Full Arm Care + Forearm Circuit": ["Band Resisted External Rotation", "Band Resisted Internal Rotation", "Prone Y-T-W", "Forearm/Wrist Roller", "DB Pronation / Supination"], "Arm Care A — Band ER/IR + Scap Y": ["Band Resisted External Rotation", "Band Resisted Internal Rotation", "Band Y-Raise (low trap)"], "Arm Care B — Prone Y-T-W + Forearm": ["Prone Y-T-W", "Wrist Flexion/Extension with Light DB", "DB Pronation / Supination"], "Cuff Circuit: Band ER/IR · Face Pull · Y-Raise": ["Band Resisted External Rotation", "Band Resisted Internal Rotation", "Banded Face Pull", "Band Y-Raise (low trap)"], "Band ER, IR, Prone T — full arm care circuit": ["Band Resisted External Rotation", "Band Resisted Internal Rotation", "Prone T"], "Full Thrower''s Ten Circuit": ["Band D2 Flexion / Extension", "Band Resisted External Rotation", "Band Resisted Internal Rotation", "Band Resisted Abduction and External Rotation at 90 Degrees", "DB Scaption", "Side-Lying DB External Rotation", "Prone Y-T-W"], "Thrower''s Ten (complete circuit)": ["Band D2 Flexion / Extension", "Band Resisted External Rotation", "Band Resisted Internal Rotation", "Band Resisted Abduction and External Rotation at 90 Degrees", "DB Scaption", "Side-Lying DB External Rotation", "Prone Y-T-W"], "Thrower''s Ten (full circuit)": ["Band D2 Flexion / Extension", "Band Resisted External Rotation", "Band Resisted Internal Rotation", "Band Resisted Abduction and External Rotation at 90 Degrees", "DB Scaption", "Side-Lying DB External Rotation", "Prone Y-T-W"], "Thrower''s Ten Circuit": ["Band D2 Flexion / Extension", "Band Resisted External Rotation", "Band Resisted Internal Rotation", "Band Resisted Abduction and External Rotation at 90 Degrees", "DB Scaption", "Side-Lying DB External Rotation", "Prone Y-T-W"], "Thrower''s Ten (abbreviated — 6 key exercises)": ["Band D2 Flexion / Extension", "Side-Lying DB External Rotation", "DB Scaption", "Banded Face Pull", "Band row", "Sleeper Stretch (gentle)"], "Hip + T-Spine Circuit — see MOBILITY tab": ["Foam Roller T-Spine Extension", "T-Spine Open Book", "Thread the Needle", "Quadruped Thoracic Rotations", "Side Lying Thoracic Windmill", "90/90 Hip Switch → Lift-Off", "Hip Airplane", "Couch Stretch w/ PPT", "Worlds Greatest Stretch", "Adductor Rock Back"], "Full Mobility Circuit — see MOBILITY tab": ["Foam Roller T-Spine Extension", "T-Spine Open Book", "Thread the Needle", "Quadruped Thoracic Rotations", "Side Lying Thoracic Windmill", "90/90 Hip Switch → Lift-Off", "Hip Airplane", "Couch Stretch w/ PPT", "Worlds Greatest Stretch", "Adductor Rock Back"], "Full Circuit — see MOBILITY tab": ["Foam Roller T-Spine Extension", "T-Spine Open Book", "Thread the Needle", "Quadruped Thoracic Rotations", "Side Lying Thoracic Windmill", "90/90 Hip Switch → Lift-Off", "Hip Airplane", "Couch Stretch w/ PPT", "Worlds Greatest Stretch", "Adductor Rock Back"], "Full MOBILITY circuit": ["Foam Roller T-Spine Extension", "T-Spine Open Book", "Thread the Needle", "Quadruped Thoracic Rotations", "Side Lying Thoracic Windmill", "90/90 Hip Switch → Lift-Off", "Hip Airplane", "Couch Stretch w/ PPT", "Worlds Greatest Stretch", "Adductor Rock Back"], "Mobility flow (MOBILITY tab - full circuit)": ["Foam Roller T-Spine Extension", "T-Spine Open Book", "Thread the Needle", "Quadruped Thoracic Rotations", "Side Lying Thoracic Windmill", "90/90 Hip Switch → Lift-Off", "Hip Airplane", "Couch Stretch w/ PPT", "Worlds Greatest Stretch", "Adductor Rock Back"], "Shoulder + T-Spine Circuit — see MOBILITY tab": ["Shoulder CARs", "Sleeper Stretch (gentle)", "Cross-Body Stretch", "Doorway Pec Stretch", "Dead Hang Lat Stretch", "Prone Y-T-W", "Band Resisted External Rotation", "Scap Push Up", "T-Spine Open Book", "Quadruped Thoracic Rotations", "Foam Roller T-Spine Extension"], "T-Spine + Shoulder Mobility Finisher": ["T-Spine Open Book", "Sleeper Stretch (gentle)", "Shoulder CARs"], "T-Spine + Hip Mobility Full Circuit": ["Quadruped Thoracic Rotations", "T-Spine Open Book", "Worlds Greatest Stretch", "90-90 Pails and Rails Hip Internal Rotation", "Couch Stretch", "Adductor Rock Back"], "Full T-Spine + Shoulder + Hip Mobility Circuit": ["Quadruped Thoracic Rotations", "T-Spine Open Book", "Shoulder CARs", "Sleeper Stretch (gentle)", "Worlds Greatest Stretch", "Couch Stretch", "Adductor Rock Back"], "Full Mobility Close-Out: T-Spine + Shoulder + Hip": ["Quadruped Thoracic Rotations", "T-Spine Open Book", "Shoulder CARs", "Sleeper Stretch (gentle)", "Worlds Greatest Stretch", "Couch Stretch", "Adductor Rock Back"], "Hip flexor + adductor flow (MOBILITY tab)": ["Couch Stretch", "Half-Kneeling Hip Flexor Stretch", "Adductor Rock Back", "Cossack Squat"], "Mobility: 90/90 · Couch Stretch · T-Spine · Calf": ["90-90 Hip Rotation", "Couch Stretch", "Quadruped Thoracic Rotations", "Calf Stretch"], "Hammer Curl + Triceps + Rear Delt": ["DB Hammer Curl", "DB Overhead Triceps Extension", "Rear Delt Fly"], "Lateral Raise + Hammer Curl + Triceps": ["Dumbbell Lateral Raise (Standing)", "DB Hammer Curl", "DB Overhead Triceps Extension"], "Lat + Pec Doorway Stretch": ["Dead Hang Lat Stretch", "Doorway Pec Stretch"], "Lat + Pec Stretch": ["Dead Hang Lat Stretch", "Doorway Pec Stretch"], "Calf + Tib Raise": ["Standing Calf Raise", "Tibialis Raise"], "Calf + Tibialis": ["Standing Calf Raise", "Tibialis Raise"], "Tibialis + Calf": ["Tibialis Raise", "Standing Calf Raise"], "Tibialis + Calf Raise": ["Tibialis Raise", "Standing Calf Raise"]}'::jsonb;
  r record;
  wx record;
  ex_ids uuid[];
  pid uuid;
  k int;
  n int;
  used text[];
  letter text;
  combo uuid;
begin
  for r in select e.id, e.title, e.category, e.video_url from exercises e where m ? e.title loop
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
      select coalesce(array_agg(upper((regexp_match(section, '(?:superset|complex|circuit)\s+([a-z])\M', 'i'))[1])), '{}')
        into used from workout_exercises
        where workout_id = wx.workout_id and section ~* '(superset|complex|circuit)\s+[a-z]\M';
      select c into letter from unnest(string_to_array('A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z', ',')) with ordinality as t(c, i)
        where not (c = any(used)) order by i limit 1;
      letter := coalesce(letter, 'Z');
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
              when wx.section ~* '(superset|super set|complex|circuit|tri-?set|giant set)' then wx.section
              else coalesce(nullif(trim(wx.section), '') || ' · ', '')
                   || case when n >= 3 then 'Circuit ' else 'Superset ' end || letter end));
      end loop;
      delete from workout_exercises where id = wx.id;
    end loop;

    if r.video_url is null and not exists (select 1 from workout_exercises where exercise_id = r.id) then
      begin delete from exercises where id = r.id; exception when others then null; end;
    end if;
  end loop;

  -- Undo one wrong split from the last fix: "Bench Lat + Thoracic Sink" is ONE drill
  if exists (select 1 from exercises where title in ('Bench Lat', 'Thoracic Sink')) then
    select id into combo from exercises where title = 'Bench Lat + Thoracic Sink' limit 1;
    if combo is null then
      insert into exercises (title, category) values ('Bench Lat + Thoracic Sink', 'Mobility') returning id into combo;
    end if;
    delete from workout_exercises we using exercises e
      where e.id = we.exercise_id and e.title = 'Thoracic Sink'
        and not exists (select 1 from workout_results res where res.workout_exercise_id = we.id);
    update workout_exercises we set exercise_id = combo
      from exercises e where e.id = we.exercise_id and e.title = 'Bench Lat';
    delete from exercises e where e.title in ('Bench Lat', 'Thoracic Sink') and e.video_url is null
      and not exists (select 1 from workout_exercises we where we.exercise_id = e.id);
  end if;
end $$;

-- Combined names still in programs: one-drill names (like "4-Way Neck + Harness") or rows an athlete already logged
select e.title, count(*) as still_there
from workout_exercises wx join exercises e on e.id = wx.exercise_id
where e.title ~* '(circuit|mobility tab|thrower|arm care|finisher|close-out)' or e.title like '% + %'
group by e.title order by e.title;
