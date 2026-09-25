-- PRD §3 / §9: weekly_metrics. ISO weeks (Monday start) in Asia/Kolkata.
-- "Decided" = approved + rejected (superseded excluded).
-- Latency: each note's FIRST draft only, telegram source, no override, never failed (plan A16).
create or replace view weekly_metrics as
with
notes_w as (
  select date_trunc('week', created_at at time zone 'Asia/Kolkata')::date as week,
         count(*) as notes_received,
         count(*) filter (where status in ('passed', 'drafted')) as notes_passed
  from notes where source = 'telegram'
  group by 1
),
drafts_w as (
  select date_trunc('week', created_at at time zone 'Asia/Kolkata')::date as week, count(*) as drafts_created
  from drafts group by 1
),
decided_w as (
  select date_trunc('week', decided_at at time zone 'Asia/Kolkata')::date as week,
         count(*) filter (where status = 'approved') as approved,
         count(*) filter (where status = 'rejected') as rejected
  from drafts where status in ('approved', 'rejected') and decided_at is not null
  group by 1
),
first_drafts as (
  select distinct on (d.note_id) d.note_id, d.created_at, n.created_at as note_created_at
  from drafts d join notes n on n.id = d.note_id
  where n.source = 'telegram' and not n.override and n.failed_stage is null
  order by d.note_id, d.created_at
),
latency_w as (
  select date_trunc('week', created_at at time zone 'Asia/Kolkata')::date as week,
         percentile_cont(0.95) within group (order by extract(epoch from created_at - note_created_at)) as p95_note_to_draft_seconds
  from first_drafts group by 1
),
weeks as (
  select week from notes_w union select week from drafts_w union select week from decided_w
)
select
  w.week,
  coalesce(n.notes_received, 0) as notes_received,
  coalesce(n.notes_passed, 0) as notes_passed,
  coalesce(d.drafts_created, 0) as drafts_created,
  coalesce(x.approved, 0) as approved,
  coalesce(x.rejected, 0) as rejected,
  case when coalesce(x.approved, 0) + coalesce(x.rejected, 0) = 0 then null
       else round(x.approved::numeric / (x.approved + x.rejected), 3) end as approval_rate,
  round(l.p95_note_to_draft_seconds::numeric, 1) as p95_note_to_draft_seconds
from weeks w
left join notes_w n using (week)
left join drafts_w d using (week)
left join decided_w x using (week)
left join latency_w l using (week)
order by w.week desc;
