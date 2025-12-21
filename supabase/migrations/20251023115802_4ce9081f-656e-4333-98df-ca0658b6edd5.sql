-- Fix the item_type check constraint to accept valid SOW values
ALTER TABLE estimate_items DROP CONSTRAINT IF EXISTS estimate_items_item_type_check;

ALTER TABLE estimate_items ADD CONSTRAINT estimate_items_item_type_check 
CHECK (item_type IN ('Framing', 'Fix out', 'Cladding', 'Decking', 'Stairs', 
                      'Rough-in', 'Drainage', 'Gas', 'Fit-off', 'Solar', 'Data',
                      'External walls', 'Fencing', 'Paving', 'Internal walls', 
                      'Ceilings', 'Cornice', 'Interior', 'Exterior', 'Preparation',
                      'Floor tiling', 'Wall tiling', 'Splashbacks', 'Footings', 
                      'Slab', 'Driveway', 'Paths', 'Roof frame', 'Tiles/Metal', 
                      'Gutters', 'Flashings', 'Retaining walls', 'Gardens'));