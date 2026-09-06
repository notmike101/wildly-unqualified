# Wildly Unqualified: MVP outing design

Date: 2026-09-05. **Status: direction approved with the user's mature-forest, skybox and expanded-model correction; implementation planning.** This extends the accepted rough prototype. It preserves the [prototype design](2026-09-05-wildly-unqualified-prototype.md), existing builds, saves and every other game concept. Approval of direction is not evidence that the MVP is implemented.

The user has chosen a 20–30-minute outing for 2–4 friends on separate internet connections, regular physical co-op challenges alongside wildlife photography, light mischief and mayhem, and a cleaner low-poly aesthetic. The user observed the [four-player prototype run](../../../PLAYTEST-2026-09-05.md) and requested improved collisions, wildlife, player identification, duration, clear paths and environmental detail. The subsequent correction makes a mature forest, an associated skybox and a substantially expanded model library explicit requirements. Remaining numeric values are reversible implementation defaults.

## Direction and alternatives

**Recommend one authored reserve with variable encounters.** Three compact habitats share field equipment and a return route. Players observe, prepare, improvise, photograph and recover from each other's mistakes. Bounded variations change animal locations and assignments while authored geometry keeps challenges legible and testable.

Adding more fixed photo conditions to the existing flat reserve would be cheaper, but leaves its weak traversal and predictable solutions intact. A large procedural wilderness with a simulated ecosystem would offer more combinations, but adds substantial world-generation, navigation and readability work before proving cooperation. The authored reserve is the smallest expansion that addresses all six observed problems together.

The [market research](../../../../../research/wildly-unqualified-teamwork-and-mischief.md) supports borrowing principles: useful shared objects, visible consequences, changing participation, and recovery that protects progress. The proposed case, screen, decoy and wildlife interactions are original applications to photography. Comparable games do not establish that this design will be enjoyable or last 20–30 minutes.

## One complete outing

Camp leads through deep woodland, a shallow washout, a sunlit forest clearing and a wooded wetland observation area. These are three habitats inside one continuous mature forest. Tall enclosing trees remain visible around the clearing and water, with a forested horizon beyond playable routes. A prepared crossing and opened return gate make revisiting locations easier. A longer dry route around the washout remains available. No level loads, compulsory countdowns or animal cooldown inflation create the duration.

At camp, the crew receives one commission for each habitat and a final two-species portrait. All four are visible from the start and can receive credit whenever their conditions are met. The habitat commissions select one of two authored behaviors per species at outing creation. The final portrait retains the prototype's raccoon-and-heron setup. Every player can photograph, scout, handle equipment and recover a mishap; there are no permanent classes.

| Beat | Target activity time, not a timer | Decisions and lasting consequence |
|---|---|---|
| Camp briefing | 2 minutes | Read four assignments, recognize the crew, pack the kit and choose which route to scout. |
| Woodland | 4–5 minutes | Follow current tracks, watch the raccoon, arrange the tin and find a clear angle. Learn that an open, unattended lure invites theft. |
| Washout and transport | 3–4 minutes | Prepare a plank crossing or use the dry detour. Coordinate carrying the field case; recover a spill if one happens. The crossing stays prepared. |
| Sunlit forest clearing | 4–5 minutes | Read the deer's attention, position a folding screen and decoy, and approach from cover. A badly placed attractor can bring the raccoon instead. |
| Wetland and combined portrait | 5–8 minutes | Learn the heron's current feeding/perching routine, arrange a quiet camera position and manage two species with different interests. Salvage incidental chaos as extra photographs. |
| Return and exhibition | 2–3 minutes | Use the prepared route, return connected players to camp, choose favorites and review the outing together. |

The total is a **20–27-minute design budget**, with room for optional pictures, not a measured duration. Skilled repeat crews may finish faster. If new players consistently finish in under 15 minutes, add a distinct decision or improve the existing encounters; do not simply stretch distances or hold animals still for longer. If confusion drives outings over 35 minutes, improve cues and remove busywork.

The exhibition requires the four accepted commissions and the connected crew's camp readiness. Existing explicit continuation without disconnected players remains. Optional mishap photos never block completion. Accepted photos and prepared route work persist through recovery and reconnects.

## Equipment and physical teamwork

Keep the existing camera, bait tin, whistle, ping and notebook. Add only the props needed for two recurring challenge types: **transport** and **observation setup**.

- **Field case:** a broad, two-handle supply case with a visible lid. One person can slowly drag it; two steer it more efficiently. It transports the outing's spare bait and provides a place to refill the tin. Players can leave it at a useful field station instead of carrying it continuously. Cameras and accepted photos are never locked inside it.
- **Crossing plank:** carried from beside the washout and placed into one of two clearly marked bank positions. Placement previews and generous alignment tolerances prevent a precision-placement chore. Once seated, it becomes a stable walkable crossing. The dry detour permits progress if players prefer another solution.
- **Folding observation screen:** the existing blind idea becomes movable equipment with two handles. One player can reposition it slowly; two can steer it around bends. Once set down it provides reliable sight-line cover. The authored site also offers natural cover, so losing control of the screen never makes an assignment impossible.
- **Decoy:** one lightweight animal-shaped lure, carried and placed by one player. The deer investigates its silhouette; raccoons investigate its accessible bait cup. Its position can help a setup, draw the wrong visitor, or put a friend in an awkward photographic composition.

Use one handling model for case, plank and screen, with per-prop size and weight values. A nearby interaction targets a clearly highlighted handle. Two holders control opposite ends; release is explicit and always available. Turns, prop collisions and mismatched movement produce small, readable motion and audible scraping. No launch impulses, involuntary long ragdolls or player grabbing are required.

Player collisions cause gentle separation. Walking into a friend can interrupt a neat setup but cannot trap them in an entrance; short body-contact escape after sustained obstruction prevents indefinite blocking. Physical objects must remain solid while held, being turned, placed and released. There must be no carry-through-wall shortcut.

In a four-person crossing, two can carry while another prepares the bank and another scouts or manages an approaching animal. At a photo setup, players can adjust cover, control the lure, watch the subject and choose an angle. Two people perform the same tasks sequentially. Helpers should rotate naturally because everyone's equipment access and controls are identical. A disconnected holder releases their handle safely; the remaining crew can continue.

## Light mischief and mayhem

Three interactions use the same equipment and animal rules as successful teamwork:

| Interaction | Clear cause | Useful or funny consequence | Recovery boundary |
|---|---|---|---|
| **Bait spill** | A sharp turn or bump while the case lid is open dislodges one unsecured portion. Opening the lid alone causes no random spill. | A visible, scented pile attracts the raccoon and may intrude on a quiet setup. | Collect the pile or let an animal consume it. At most one portion per physical incident; secured stock cannot cascade out. Camp can replenish a depleted outing. |
| **Decoy interference** | A player deliberately moves the decoy or its bait cup while a setup is developing. | The subject changes interest; another species may arrive; the crew can reframe or restore the arrangement. | Ordinary pickup and placement restore control. No cooldown locks the original photographer out, and an animal eventually loses interest in an unchanged lure. |
| **Hat thief** | A curious raccoon approaches a conspicuous hat within reach while its wearer crowds it. A visible look and reach telegraph the attempt. | It briefly wears or carries the crew-colored hat, creating an optional photo opportunity and a recognizable victim. | Retrieve the hat nearby or recover it when the raccoon drops it within 30 seconds at a reachable site. Per-player repeat protection prevents immediate theft chains. Name and crew-number identification remain visible. |

Mishaps should take seconds to recover from; losing supplies can create a short resupply decision. They never delete accepted photographs, erase commissions, close prepared routes, disable cameras or turn a player into a spectator. There is no progression reward for repeatedly sabotaging teammates. Funny pictures can be favorited for their own sake.

Keep this limited to private crews. Provide reliable set-down/reclaim actions and escape from body blocking before adding more disruptive toys. Ordinary choices should explain the chain: a lid was open, a corner was hit, bait fell, a raccoon arrived, somebody got the shot. No invisible random failure roll supplies the joke.

## Wildlife and replay variety

Retain raccoon and heron; add one deer archetype. Cosmetic animal variants already present remain. Each species uses a small explicit behavior state machine, reachable authored goal locations, perception and a short memory of recent choices. The reserve does not need a general ecosystem or an AI service.

| Species | Readable interests and reactions | Two possible habitat commissions |
|---|---|---|
| Raccoon | Investigates accessible food and unusual objects; looks before approaching; steals loose items; retreats toward a reachable stash. | Inspect an open bait tin, or wash a recovered food portion at the woodland stream. |
| Deer | Alternates grazing and scanning; investigates the decoy when calm; hears running and notices exposed close players. | Graze with a clear profile, or investigate the decoy calmly. |
| Heron | Chooses feeding and resting sites; reacts to disturbance and nearby animal activity; gives a visible warning before leaving. | Preen at a resting perch, or display at a calm baited feeding site. |

Choose goals from local evidence and available navigation links, with a bounded seeded tie-break between valid options. Avoid immediately repeating the same destination when another appropriate one exists. Tracks and body language reveal changes. Seed differences must not conceal every valid subject or create unreachable objectives.

Interest in a stationary lure expires visibly; holding the tin open cannot maintain the raccoon's inspect state forever. Animals then resume a nearby routine and can be re-engaged after a change of setup. The final portrait has multiple valid reachable staging spots and can be attempted repeatedly without a compulsory resupply trip after every miss.

Variation comes from two authored encounter sites per habitat, two commission choices per species, animal starting routines and the crew's own equipment placement. Select only compatible configurations at outing creation and save the exact choices. Terrain and route topology remain authored. Weather simulation, procedural terrain and further species are deferred until these combinations demonstrate value.

## Reserve, collision and visual polish

Build a mature, enclosed forest at human scale. Main trees stand approximately 18–32 metres tall, with substantial branching trunks, buttress roots, irregular crowns and overlapping canopy. Group several distinct silhouettes in believable stands. Frame distant views with forested ridges and receding trunks so the reserve feels situated in a larger woodland. Ground detail is ferns, needles, leaves, roots, moss and fallen timber; small ornamental trees and shrub clusters do not supply the main forest mass.

Deep woodland has cooler shade and large trunks; the forest clearing admits warmer light beneath an irregular canopy opening; the wooded wetland has alder-like trees, exposed banks, reeds and reflected sky. Keep the same restrained low-poly palette and material treatment across all three. Signs, silhouettes, terrain edges and contrasting trail surfaces orient players. Restrained ambient sound and existing captions reinforce readable events.

The current 24-prop kit is useful prototype material, but it is insufficient for this direction. Build the [version-3 asset brief](../../../assets/BRIEF-v3.md): 29 forest/environment models, one articulated deer, one researcher body with removable headwear, four hat shapes and four interactive equipment assemblies. That is **39 planned authored models or geometric variants**, excluding retained prototype assets and material recolors. Each must serve an identified placement or gameplay purpose. Author representative large trees and an in-game forest composition first, then complete the library against that visual standard. Delivery depends on silhouette, scale, composition and runtime verification as well as inventory count.

Add a full surrounding skybox using the installed WebGPU atmospheric sky: a blue-gray daylight gradient, soft broken cloud cover, one coherent sun direction and horizon haze matched to the woodland fog and lighting. Clouds remain static for this outing so live and restored photographs agree. Sky must be visible through crown gaps, above the clearing and over water, without seams, a flat background, abrupt clipping or a pasted photographic style. The sun, canopy shadows and ground illumination must agree. Tune exposure for readable shaded crew and animals; atmospheric effects cannot conceal a required subject or wash out player accents. No new weather service, day/night cycle or paid sky asset is required.

Author the trail and clear camera corridors first, then place scenery from the expanded library. Reuse appropriate existing camp props where they match the new scale and finish. Preserve all original asset files. Batch repeated static tree geometry/materials with the installed renderer; foliage density and distant silhouettes must fit the measured WebGPU budget.

Use one placement record in `level.ts` for each gameplay-relevant object: stable ID, asset, transform, collision shape, visibility/occlusion bounds and interaction or navigation attachment when needed. Rendering, authoritative collision, client movement prediction, animal navigation and photo checks consume that same data. Decorative grass and small flowers are nonblocking; trunks, boulders, equipment and closed structures are solid. Doorways and screen windows use separate shapes around their openings.

Keep the main trail at least four metres clear at bends and handles, with six metres of overhead clearance on equipment routes. Higher branches may arch above that corridor to maintain enclosure. Validate the full polyline and actual placed bounds, including return routes, rather than approximating it with one line equation. Add a few authored walkable ramps and shallow banks; this is not a climbing or swimming system. Invalid falls or stuck loose equipment recover at the nearest safe local position without resetting earned progress.

Give each persistent crew slot a distinct high-contrast accent on a large outfit area, hat and pack, plus a number/icon. Show the field name and that identifier above nearby visible teammates, with matching roster, ping and equipment-handle indicators. Keep text legible against both foliage and sky, respect occlusion, and suppress HUD labels in captured photographs. Slot colors survive reorder and reconnect. The prototype already contains material tinting; validate the actual outfits under game lighting before attributing its weak readability to a renderer bug.

New forest models, deer, headwear and equipment must have coherent scale, readable silhouettes and grounded origins; interactive items need obvious handles and correct pivots. Author and inspect additions in **visible foreground Blender**, save new versioned source/export files, and preserve both existing scenes. Only claim MCP use if an actual Blender MCP connection is available and exercised; the previous version used visible Blender without MCP. No background asset generation is authorized.

## Existing architecture and persistence

Retain the installed Three.js/WebGPU, Box3D, TypeScript and authoritative Node/WebSocket server. Preserve private admission, bounded inputs/uploads, immutable server-owned photo credit, actual JPEG capture, reconnect and configurable origin/data paths. No new service or runtime dependency is needed for this design.

| Existing area | Required change |
|---|---|
| `level.ts` | Shared authored placements, walkable surfaces, route links and valid encounter sites. |
| `shared.ts` | Stable crew identity; typed carry/placement actions; new prop, animal and assignment state; updated immutable capture data. |
| `physics.ts` | Solid held and loose props, bounded contacts, safe set-down and recovery using existing Box3D and shared movement rules. |
| `game.ts` | Carry ownership, route preparation, perception-driven animal decisions, four selected assignments, spill/decoy/hat events and recovery. |
| `view.ts`, `main.ts`, `style.css` | Shared-world rendering, clear handling feedback, names/crew identifiers, new animations and readable notebook/exhibition at small window sizes. |
| `save.ts`, `server.ts` | Validate and persist the expanded world, preserve admission rules, release disconnected handles and restore paused state safely. |
| Existing rule, physics, save, socket and browser tests | Verify the new contracts and failure cases through the same production paths. |

Extract a focused encounter module only if the new wildlife/commission logic would otherwise further overload `game.ts`; do not introduce an entity framework or generic scripting language. Keep existing protocol tick rates and measured performance assumptions until changed behavior provides evidence to tune them.

Each saved outing includes its content version, seed/configuration, completed commissions, route preparation, props and supplies, animal state, stable crew slots, accepted photo records and shared favorite selections. The current favorite button only toggles local UI state; the exhibition needs persistent per-player choices with server validation. A small caption can record a witnessed spill or hat incident; no generated narration or video pipeline is needed.

Capture frames must freeze the actual prop transforms, animal states, hats, crew identity and world configuration used for both geometry checks and image generation. A shared render helper must render the same immutable scene for live and restored captures. Current JPEG size/type limits and the rule that uploaded pixels cannot grant credit remain.

Use an explicit new save schema/content version and a **new MVP data directory**. Preserve the original release and prototype save directory so the accepted outing remains available. Do not silently interpret old world coordinates as the new reserve or overwrite incompatible saves. Future moves of the MVP carry its complete data directory and host recovery key to the portable server; the inaccessible home server remains unverified until that move is tested.

Costs remain the existing $100 individual subscription, free/open-source tools and unpaid owner time. Infrastructure, electricity, storage/backups, optional domain and publishing fees are possible cash costs; none are purchased by this design. Each player pays once in the intended product; no paid-host tier or paid runtime AI is introduced.

## Delivery order and acceptance

This is one outing expansion, delivered in reviewable increments. The [implementation plan](../plans/2026-09-05-wildly-unqualified-mvp.md) carries the approved forest correction into concrete tasks.

1. **Physical and visual foundation:** one coherent world placement model; representative mature-tree assets and a composed forest scene with atmospheric sky; solid trunks/props; clear paths; stable player colors, names and identifiers. Validate scale and composition in first person before completing repeated model families.
2. **One complete co-op problem:** working case, plank crossing and transport recovery with two and four connected players. Establish reliable ownership, contact and reconnection before multiplying interactions.
3. **Full reserve and wildlife:** three habitats, the screen/decoy, three species, four assignments and bounded encounter variation. Preserve existing photo authority and return flow.
4. **Mischief and exhibition:** integrate the three short-lived incidents, their actual photographs, saved favorites and completed ending; finish and integrate all model families, then compose the forest detail pass around verified routes.
5. **Visible end-to-end validation:** two different four-player outings and one two-player outing, including all commissions, mishap recovery, camp return and exhibition. Close test browsers when finished.

| Gate | Evidence required |
|---|---|
| Collision and clear routes | Walk and carry against trunks, rocks, banks, screen openings and tight turns; neither client nor server passes through solids. All selected sites have a usable approach, camera angle and return route. |
| Readable crew | Four outfits visibly distinguishable in both sunlit clearing and forest shade; names/numbers readable and stable after reconnect. Photographs contain scene imagery without HUD labels. |
| Wildlife variety | Different seeds select valid sites/routines; reachable subjects react to actual noise, cover and props. No perpetual held-tin inspection or unreachable photo requirement. |
| Useful cooperation | Two people can finish every problem; four have opportunities to contribute. Record prolonged idle periods and whether someone becomes a permanent porter. Do not infer participation from connection counts. |
| Recoverable mischief | Spill, bad decoy placement and stolen hat each have a visible cause and tested recovery. Repeat interference cannot erase progress, lock controls or lose essential equipment. |
| Save and network reliability | Interrupt while carrying and while a photo is pending; restore paused, release stale handles, preserve earned state and favorite choices. Exercise the existing 150 ms injected-delay path plus real HTTPS/WSS. |
| Finished loop | All commissions, real shared JPEGs, all connected players at camp, exhibition and persisted selections work at both normal and compact four-window sizes. The earlier visible run did not verify its exhibition. |
| Forest, sky and model quality | First-person views at camp, beneath deep canopy, in the clearing and beside the water read as one mature forest. Inspect upward and toward the horizon for cloud seams, clipping and lighting mismatch. Verify all 39 planned model entries, articulated pivots, solid bounds and identifiable silhouettes. Small props cannot substitute for full-sized canopy trees. |
| Performance and assets | Verify real hardware WebGPU, inspect final models in-game, and compare frame cost with the existing single-viewport baseline, including dense canopy and visible sky. Report four-window contention separately. No software-rendered performance substitution. |
| Duration and replay appeal | Record actual human outings when players are available, including idle time, recoveries and desire for another run. Guided agent timings remain technical evidence. No 20–30-minute or enjoyment claim before measurement. |

No store packaging, integrated voice, public matchmaking, economy, competitive scoring, complex crafting, combat, full ragdoll simulation or additional habitat pack is needed to prove this outing. Those remain later choices driven by playtest evidence.
