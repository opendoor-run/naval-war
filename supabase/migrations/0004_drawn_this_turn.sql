-- Track whether the current turn-holder has already drawn this turn, so the
-- server can enforce "draw, then play/discard" OR "airstrike instead of
-- drawing" as mutually exclusive - previously nothing stopped drawing and
-- then also launching an airstrike (or drawing twice) in the same turn.
alter table games add column if not exists drawn_this_turn boolean not null default false;
