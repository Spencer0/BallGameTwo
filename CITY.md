# CITY.md — making the outdoor levels real

Feedback (round 2): from the Cul-de-Sac on, the levels read as "a hodge-podge of assets to be rolled over":
fences not touching and turned the wrong way, streets that just end, nothing moves. Goal: places that feel
**cohesive, coherent, realistic and alive**, still in the flat graphic style (STYLE.md).

Definition of done (from the brief): a panel of independent reviewer agents, each with a different lens,
all judge L4–L6 cohesive, coherent and realistic from screenshot sets + motion strips + map views.

## 1. Principles

1. **Plan first, props last.** Every level starts as a plan: road network → blocks → lots/parcels → buildings
   → yards/furniture → life. No prop is scattered without a reason to be where it is.
2. **One connected network.** Every road ends at another road, a cul-de-sac bulb, water with a bridge, or the
   map edge (continuing into the fog). Intersections are real: asphalt patch, crosswalks, stop lines, signals
   or stop signs. Sidewalks run continuously along blocks.
3. **Frontage rules.** Buildings face the street they sit on, at a consistent setback for their zone.
   Suburbs: lawn + driveway + garage; town Main Street and city: street walls (party-wall buildings touching).
   Corners and block ends are handled, not left ragged.
4. **Zoning gradients.** Land use and height change gradually and explainably: downtown → mid-rise →
   row houses → houses → farms; industry by water and rail; parks as whole blocks.
5. **Fences, hedges, rows tile.** Linear things are laid end to end along a line with their long axis along
   it, panel length = spacing. Back-lot fences form closed runs.
6. **Life is systemic.** Traffic drives in lanes on the network, turns at intersections, stops at red lights
   and for the ball; pedestrians walk sidewalks and cross at crosswalks; animals graze/flock; trains run on
   tracks; boats on water routes; planes take off. Every moving thing is still a thing you can roll up.
7. **Read at phone size.** Silhouettes and colour blocking first; detail second. Repetition is fine when it
   is the repetition real places have (a row of brownstones), not random.

## 2. Real-world references

| Level | Modelled on | Signature structure |
|---|---|---|
| 4 Cul-de-Sac "Maple Loop" | A 1990s North American subdivision off a suburban arterial | Arterial avenue with a strip mall and gas station; one entrance road; a collector loop; cul-de-sacs with bulbs and pie lots; 20 m lots with front lawns, driveways to garages, street trees, mailboxes, back yards behind continuous privacy fences; elementary school + field; neighbourhood park with pond and playground |
| 5 Small Town "Puddleford" | A Midwestern county seat on a river (Galena IL, Stillwater MN) | Courthouse in the middle of its square, two-storey brick commerce facing it on all four sides; Main Street storefronts with angled parking, one light and four-way stops, municipal lots behind; deep avenue lots with alleys and big trees; a meandering river narrowing under three bridges (Mill Road, the railroad, Route 9), Water Street riverfront park and boat landing, the mill and its weir; double-track main line with depot, co-op elevator and level crossings; high school and ball field; fairground; lake with beach, marina and lakeside park; fields edge to edge on section roads with hedgerows, farm tracks, orchards, pastures and farmsteads in shelterbelts |
| 6 The Big City | Manhattan and its rivers | Long island between two rivers; the grid north of Houston (one-way avenues, cross streets, every fourth two-way); Broadway on a diagonal, pedestrianised round the plaza of screens and for the block either side of each avenue it crosses (the bow-ties: the avenue runs straight through a signalised zebra), its corner triangles paved as islands; below Houston older streets on Broadway's bearing tapering to Battery Park; Central Park as one 2.5:1 superblock (curving drive, sunken transverses, Lake, Reservoir, Mall, lawns, woods); height peaks in midtown and the financial district, Village brownstone terraces between; shore drives and piers; three bridges east to a rowhouse borough with rear yards, an El, a stadium, a park; one bridge west to Jersey City (waterfront towers, a second avenue of mid-rises behind), a freight rail yard, the airport and the port |

## 3. Systems

### 3.1 Road network (`src/levels/city/network.js`)
- Graph of nodes and edges; an edge is a polyline (straight, or arcs for loops and bends) with a road class:
  `arterial` (4 lanes, median line), `street` (2 lanes), `lane` (narrow, no line), `oneway` (avenues),
  `highway`, `rail`, `path` (park).
- Derived geometry: node radius (max incident half-width), trimmed edge ranges, intersection patches with
  crosswalk stripes on each entering arm, cul-de-sac bulbs, sidewalks on both sides (gaps at crossings),
  **frontages** (each edge side, between corners) for lots and buildings, **lanes** for traffic (right-hand
  traffic; connectors through nodes), **sidewalk paths** for pedestrians with crossings between corners.

### 3.2 Street surface mesh (`src/render/streets.js`)
One merged mesh, one draw call, one shader: asphalt with lane markings (dashed / double yellow / edge
lines), intersection patches with zebra crosswalks and stop lines, sidewalks with tiles and a curb line,
driveways, parking lots with bay stripes, rail track (ballast, ties, rails), field rows, park paths, plazas.
Per-vertex local UV + kind + parameters; fog as everything else.

### 3.3 Life (`src/game/life.js`)
- **Traffic**: vehicles follow lanes, choose turns at nodes, car-follow (keep gap), obey signals (two-phase
  cycles at signalised nodes; traffic-light tint shows red/green), U-turn around cul-de-sac bulbs, stop and
  honk when the ball blocks the lane. Leave the network only when rolled up or knocked.
- **Pedestrians**: walk sidewalk paths at 1.2–1.6 m/s with a waddle, cross at crosswalks, pause at shop
  windows; some walk dogs; joggers run; they scatter from a ball big enough to eat them.
- **Animals**: cows/sheep/horses graze slowly inside their pasture fences; pigeons/gulls sit in flocks and
  burst into the air when the ball comes near, then land elsewhere.
- **Rail**: trains (locomotive + cars) run on rail polylines; crossing signals.
- **Water**: boats on route loops (ferries shuttle between piers, tugs, sailboats tack slowly).
- **Air**: planes taxi, take off and climb out of the airport; helicopters circle; balloons drift; blimp.
- **Mechanisms**: ferris wheels, windmills and water wheels turn; flags wave.
- **Sim LOD**: full rate near the camera/ball, round-robin slices further away; zero per-frame allocation.

### 3.4 Sound
Ambient bed per level (suburban birds + distant mower; town; city traffic rumble), positional one-shots:
honks, train horn and crossing bell, ship horn, pigeon flutter.

## 4. Assets to add (see ASSETS.md once built)
Shared street kit (pack L4): traffic light, street tree, privacy fence panel (tiles), more houses with
attached garages, school, flagpole, strip mall, jogger, business person, pigeon, taxi, police car, SUV,
hatchback, mail truck, street sign, parking meter, newspaper box.
Town (pack L5): brick storefronts (party walls) in several widths, town hall, library, post office, depot,
grain elevator, diner, motel, farmhouse, crossing signal, freight cars, road and rail bridge spans,
rowboat/canoe/barge/tug/boathouse, ranch fence, scarecrow, combine harvester, mill + water wheel, split
ferris wheel / windmill parts so the moving part can turn.
City (pack L6): brownstone row house, tenements, mid-rises and high-rises with flat party walls, screen
building, subway entrance, newsstand, hot-dog cart, food truck, ambulance, limo, ferry, suspension bridge,
elevated rail viaduct + train, airport terminal/control tower/hangar, pier shed, bandshell, rooftop water tank.

## 5. Review protocol (definition of done)
`tests/city_review.mjs` renders, per level, with the HUD hidden:
- 6 gameplay-camera views (3 at start size in different districts, 3 with a mid-size ball),
- 3 aerial oblique views of whole districts, 1 top-down map of the network and land use,
- 2 motion strips (4 frames, 0.5 s apart) at a busy street/intersection,
- stats: moving agents by kind, network connectivity, dead ends, overlaps.
Panel (independent agents, fresh context, given images + stats, not my conclusions):
1. **Urban planner** — network connectivity, block/lot structure, zoning gradient, frontage, plausibility.
2. **Art director** — cohesion, scale consistency, silhouettes at phone size, style match, composition.
3. **Life & simulation** — does it feel alive: traffic in lanes, pedestrians, animals, mechanisms.
4. **QA / skeptic** — floating or intersecting objects, props in roads, z-fighting, dead ends, repetition.
Each returns PASS/FAIL per level with concrete issues. Iterate until all four PASS all three levels.
