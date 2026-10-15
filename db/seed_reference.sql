-- Reference data: provinces, districts, events. Safe to re-run.
SET search_path = slaa, public;

INSERT INTO province (name) VALUES
  ('Western'), ('Central'), ('Southern'), ('Northern'), ('Eastern'),
  ('North Western'), ('North Central'), ('Uva'), ('Sabaragamuwa')
ON CONFLICT DO NOTHING;

INSERT INTO district (name, province) VALUES
  ('Colombo', 'Western'), ('Gampaha', 'Western'), ('Kalutara', 'Western'),
  ('Kandy', 'Central'), ('Matale', 'Central'), ('Nuwara Eliya', 'Central'),
  ('Galle', 'Southern'), ('Matara', 'Southern'), ('Hambantota', 'Southern'),
  ('Jaffna', 'Northern'), ('Kilinochchi', 'Northern'), ('Mannar', 'Northern'),
  ('Vavuniya', 'Northern'), ('Mullaitivu', 'Northern'),
  ('Batticaloa', 'Eastern'), ('Ampara', 'Eastern'), ('Trincomalee', 'Eastern'),
  ('Kurunegala', 'North Western'), ('Puttalam', 'North Western'),
  ('Anuradhapura', 'North Central'), ('Polonnaruwa', 'North Central'),
  ('Badulla', 'Uva'), ('Monaragala', 'Uva'),
  ('Ratnapura', 'Sabaragamuwa'), ('Kegalle', 'Sabaragamuwa')
ON CONFLICT DO NOTHING;

INSERT INTO event (code, name, category, sort_order) VALUES
  ('100m',    '100 metres',              'sprints',          10),
  ('200m',    '200 metres',              'sprints',          20),
  ('400m',    '400 metres',              'sprints',          30),
  ('800m',    '800 metres',              'middle_distance',  40),
  ('1500m',   '1500 metres',             'middle_distance',  50),
  ('3000m',   '3000 metres',             'long_distance',    60),
  ('5000m',   '5000 metres',             'long_distance',    70),
  ('10000m',  '10,000 metres',           'long_distance',    80),
  ('100mH',   '100 metres hurdles',      'hurdles',          90),
  ('110mH',   '110 metres hurdles',      'hurdles',         100),
  ('400mH',   '400 metres hurdles',      'hurdles',         110),
  ('3000mSC', '3000 metres steeplechase','hurdles',         120),
  ('HJ',      'High jump',               'jumps',           130),
  ('PV',      'Pole vault',              'jumps',           140),
  ('LJ',      'Long jump',               'jumps',           150),
  ('TJ',      'Triple jump',             'jumps',           160),
  ('SP',      'Shot put',                'throws',          170),
  ('DT',      'Discus throw',            'throws',          180),
  ('HT',      'Hammer throw',            'throws',          190),
  ('JT',      'Javelin throw',           'throws',          200),
  ('4x100m',  '4 x 100 metres relay',    'relays',          210),
  ('4x400m',  '4 x 400 metres relay',    'relays',          220),
  ('HEP',     'Heptathlon',              'combined',        230),
  ('DEC',     'Decathlon',               'combined',        240),
  ('RW',      'Race walk',               'race_walk',       250)
ON CONFLICT DO NOTHING;
