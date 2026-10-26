# LINT ROLLER — Game Design

> A tidy-obsessed flamingo hires a tiny dust bunny to clean up the breakfast table.
> Then the room. Then the house. Then, unfortunately, the city.

Technical plan for scale, rendering and performance lives in [TECH.md](TECH.md).
Visual rules live in [STYLE.md](STYLE.md). Running decisions live in [DECISIONS.md](DECISIONS.md).

## 1. Pitch

**Lint Roller** is a portrait, one-thumb, roll-and-grow game. You are **Lint**, a small and
very earnest dust bunny who pushes a sticky ball of fluff. Anything small enough sticks to it.
The ball grows, so bigger things become sticky-able, until you are rolling up skyscrapers.

Lint works for **Madame Prudence Plume**, Inspector-General of Tidiness, a flamingo with a
monocle, a clipboard and no sense of proportion. Every time Lint finishes tidying something,
Prudence notices that the *thing around it* is messy too.

## 2. Characters

| Character | Who | Look (silhouette first) |
|---|---|---|
| **Lint** | A dust bunny. Literally: a fluff ball with long bunny ears. Says nothing; communicates by ear-wiggles. Takes every job extremely seriously. | Lavender-grey round body, two tall ears, big dot eyes, pink cheeks, tiny orange sneakers. |
| **Madame Prudence Plume** | Flamingo. Inspector-General of Tidiness. Speaks in memos. Says "Tut-tut." Thinks the city is "a bit much." | Hot-pink S-curve neck, monocle, pearl necklace, clipboard, tiny feather duster. |

## 3. Story beats (short, funny, skippable)

Each beat is 2–4 speech cards. Tap to advance, "Skip" always visible. Prudence's portrait
changes expression (`stern`, `shocked`, `pleased`).

- **Intro (before L1)**
  - (stern) "Lint. The Grand Tidiness Inspection is TODAY."
  - (shocked) "Look at this breakfast table. Crumbs. Peas. A *spoon*, lying down like it pays rent."
  - (stern) "Tidy it. How? Roll it up into a ball, obviously. That's what you're for."
- **L1 → L2** (pleased) "The table is spotless." (shocked) "Unfortunately, it is standing in a bedroom that looks like a sock exploded."
- **L2 → L3** (pleased) "The bedroom passes." (stern) "The rest of the house has been informed and is *not* taking it well."
- **L3 → L4** (shocked) "I looked out of the window. I wish I hadn't." (stern) "The whole cul-de-sac. Chop chop."
- **L4 → L5** (stern) "The neighbours have complained that you tidied them." (pleased) "The rest of town is jealous. Fair's fair."
- **L5 → L6** (stern) "One last thing on my clipboard." (shocked) "...It says 'the city'. Who wrote that? Oh. Me."
- **Ending** (pleased) "Magnificent. Not a crumb in sight." (shocked) "Lint... where IS the city?" Lint points at the ball. (stern) "I see. Well. Put it somewhere tidy." → credits.

Level-fail lines (timed mode, target missed): Prudence is disappointed but polite:
"Tut-tut. Almost tidy is still untidy. Again!" (several variants).

## 4. Core loop

1. Pick level → pick mode (Zen / Timed) → short story beat (skippable).
2. Roll. Things smaller than your pickup threshold stick. The ball grows. Bigger things become
   collectible. Things too big are obstacles: bumping them hard knocks recent pickups loose.
3. Size milestones trigger a fanfare. In timed mode the target size is the goal; stars reward
   overshooting it.
4. Results: final size, ball turntable, everything you rolled up (new items highlighted),
   stars, Prudence's verdict, postcard.

### Sticking rules (source of truth: `src/game/rules.js`, unit-tested)
- Every object type has a **pickup size** `s = 0.5·maxDim + 0.5·midDim` (the smallest dimension
  is ignored so pencils and plates behave intuitively).
- Collectible when `s ≤ PICK_RATIO · ballDiameter` (`PICK_RATIO ≈ 0.5`, tuned in play).
- Objects with `s` up to `1.35×` the threshold **wobble** when bumped ("almost!").
- Growth adds effective volume: `r³ ← r³ + GROWTH · V_eff`, `V_eff = bboxVolume · fill`.
- Bumping an uncollectible object above a speed threshold: bounce, screen-shake, and the most
  recently stuck 1–N items fly off and land as collectible objects again.

### Modes
- **Zen**: no timer. Roll as long as you like. The pause menu has "Finish". If you finished
  bigger than the level's target size, the level counts as completed (unlocks the next).
  The target is shown as a gentle goal.
- **Timed**: a target size and a generous time limit. Reaching the target = completed (1★).
  Stars for final size at time-out: ★ ≥ target, ★★ ≥ 1.4× target, ★★★ ≥ 1.9× target
  (per-level, balanced by `tools/balance.mjs`). After reaching the target the player may
  keep rolling for stars or tap "Finish".
- Completing a level in either mode unlocks the next one.

## 5. Controls

- **Floating joystick**: touch anywhere on the lower ~80% of the screen to place the stick, drag to roll.
  Direction is relative to the camera; push up to roll forward.
- **Auto camera**: yaw eases toward the ball's direction of travel when moving forward-ish, so
  holding left curves the ball and the camera follows. Pulling straight back reverses without
  spinning the camera.
- **Quick turn**: double-tap to swing the camera 180°.
- Camera pull-back is driven by ball radius with smoothing (and a little extra on milestones).
- Keyboard (desktop testing only): WASD / arrows, Q/E to turn, Space quick-turn.

## 6. Levels

Each level is a separate world sized for its scale. Sizes are ball **diameter**.

| # | Name | World | Start | Target | Timed limit | Theme music |
|---|---|---|---|---|---|---|
| 1 | Crumb Patrol | Farmhouse breakfast table, 2.4 × 1.4 m (Prudence supervises) | 4 cm | 22 cm | 4:00 | "Crumb Patrol" — bossa-funk, Rhodes + brushes + whistle |
| 2 | Bedroom Bedlam | Kids' bedroom, 7.6 × 6.2 m | 20 cm | 1.1 m | 6:00 | "Sock Drawer Stomp" — clavinet toy-funk + glockenspiel |
| 3 | House Party | Cut-away bungalow (low dollhouse walls) + garden, 34 × 26 m | 1 m | 5 m | 8:00 | "Household Shuffle" — swing, walking bass, muted horn |
| 4 | Cul-de-Sac | Maple Loop: a street network with three turning circles, park, school field, 480 × 480 m | 4.5 m | 22 m | 8:00 | "Cul-de-Sac Strut" — disco-funk, octave bass, brass stabs |
| 5 | Small Town | Puddleford: town grid, suburbs ring, farms, harbour, fairground, railway, 1.5 × 1.5 km | 10 m | 90 m | 9:00 | "Main Street Mambo" — mambo/latin jazz, piano montuno, cowbell |
| 6 | The Big Tidy | Downtown, port, airport, stadium, space centre, outer districts, sky, 4.4 × 4.4 km | 30 m | 400 m | 10:00 | "Skyline Shuffle" — big-band funk finale |

Total timed play ≈ 45 min; Zen is open-ended.

**Balance & calibration.** Three tools keep this honest: `tools/balance.mjs` (enough material for ★★★),
`tools/sweep.mjs` (a fast time-based model) and `tests/calibrate.mjs` (the real game + autopilot, played until
the clock runs out). The target profile for every level: the bot reaches the goal at roughly 35–55 % of the
timer, and ★★★ needs most of what the level holds. Outdoor levels grow explosively once the ball is big
(sweep area grows with diameter × speed), so they have bigger maps, a slightly heavier pace and slower growth
(per-level `speed`/`growth`), and star ladders set near the full-sweep size:

| Level | Stars (× goal) | pace | growth | bot: goal reached at |
|---|---|---|---|---|
| 1–2 | 1 / 1.4 / 1.9 | 1 | 1 | 30–48 % |
| 3 | 1 / 1.5 / 1.9 | 0.9 | 0.75 | 27–39 % |
| 4 | 1 / 2.6 / 5 | 0.85 | 0.6 | 36 % |
| 5 | 1 / 2.2 / 3.2 | 0.8 | 0.5 | 42 % |
| 6 | 1 / 1.4 / 1.65 | 0.65 | 0.35 | 45 % |

### Level object lists (sizes are max dimension)

Objects carry over: a city still contains people and cars; they're just tiny then (see TECH.md,
"tiny-object cutoff").

**L1 Crumb Patrol (table top)** — food, cutlery, small household odds
ant, ladybug, crumb, pea, cereal loop, blueberry, sugar cube, button, thumbtack, coin, ring,
thimble, die, bottle cap, grape, cherry, wrapped candy, snail, eraser, spool, chess pawn,
strawberry, battery, key, paperclip, egg, sticky note, matchbox, cookie, birthday candle,
orange, apple, lemon, cupcake, toy car, crayon, rubber duck, boiled egg in cup, teacup,
salt shaker, jam jar, donut, toast, mug, juice box, pancake stack, croissant, pencil,
glasses, smartphone, pepper mill, spoon, fork, butter knife, tv remote, banana, bowl,
milk carton, teapot, plate, toaster, bread loaf, vase of tulips, cereal box, newspaper.

**L2 Bedroom Bedlam** — toys, clothes, kid stuff (+ small L1 items scattered)
marble, building block, yo-yo, baseball, crayon box, alarm clock, piggy bank, hamster,
headphones, toy train, sock, soccer ball, slipper, basketball, book, comic stack, sneaker,
fishbowl, toy robot, video game console, trophy, teddy bear, drum, laptop, desk lamp, globe,
board game, trash can, toy rocket, backpack, pillow, cat, stool, tennis racket, skateboard,
kite, umbrella, chair, beanbag, guitar, desk, dresser, floor lamp, bookshelf, bed.

**L3 House Party** — furniture, appliances, family, garden
garden gnome, potted plant, dog, vacuum cleaner, toilet, washing machine, flamingo lawn ornament,
birdbath, barbecue grill, armchair, lawn mower, coffee table, kitchen stove, TV, wheelbarrow,
doghouse, person (adult/kid/grandpa variants), bicycle, piano, bathtub, fridge, sofa, kitchen
table, wardrobe, grandfather clock, kiddie pool, hedge.

**L4 Cul-de-Sac** — street life
traffic cone, fire hydrant, mailbox, trash bin, dog, person, bench, bicycle, stop sign,
lemonade stand, phone booth, fence, picnic table, shed, basketball hoop, swing set, trampoline,
playground slide, round tree, pine tree, bush, street lamp, bus stop, car (variants),
pickup truck, ice-cream van, delivery van, garbage truck, school bus, small house (variants),
garage, treehouse, hot-air balloon.

**L5 Small Town** — town, farm, harbour
cow, horse, hay bale, tractor, statue, fountain, gazebo, carousel, sailboat, fishing boat,
city bus, fire truck, locomotive, train car, shop (variants), café, bakery, barn, silo,
billboard, gas station, windmill, water tower, church, lighthouse, clock tower, circus tent,
ferris wheel, radio mast, apartment block.

**L6 The Big Tidy** — city, port, sky
helicopter, airplane, blimp, container stack, cargo crane, cargo ship, cruise ship,
office block, skyscraper (3 styles), apartment tower, museum dome, cathedral, factory,
parking garage, stadium, giant donut shop, obelisk monument, giant statue, observation tower,
big wheel, rocket on launch pad, suspension-bridge tower, cloud.

Total: 170+ distinct object types plus colour/size variants. The exact registry is
`tools/blender/assets/*.py` and the generated `assets/catalog.json`.

## 7. Juice checklist

- Pickup: object zips onto the ball with a squash-pop, sparkle burst, pitch-rising combo chime
  quantised to the level's key, and a name card ("+ Teacup") with its icon.
- Material-aware pickup sounds (soft, wood, metal, glass/ceramic, food, plastic, paper,
  electronic, living, stone).
- Camera pulls back smoothly with size; FOV kick on milestones.
- Size milestones (every "nice" size: 5, 10, 20, 50 cm, 1, 2, 5, 10 m…): fanfare sting,
  big number stamp, confetti, ball flashes.
- Bounce off big things: thud, dust puff, screen-shake scaled by impact, items knocked loose.
- "Almost" wobble on slightly-too-big objects.
- Creatures (ants, cats, people) wander; small ones flee from a ball that can eat them.
- Results: the actual ball on a turntable, items tumble into a list, stars stamp in.

## 8. Meta & extras (see DECISIONS.md for why)

- **Collection log**: every object type ever picked up, with icon, name, a one-line joke
  description, and count. Silhouettes for undiscovered ones. Saved in localStorage.
- **Ball skins**: unlockable core patterns/colours (stars and collection milestones).
- **Postcard**: results screen renders a shareable postcard image of your ball; long-press to save.
- **Settings**: music volume, SFX volume, haptics (where supported), graphics quality
  (Auto / Low / Medium / High), invert-free camera assist toggle, reset progress.
