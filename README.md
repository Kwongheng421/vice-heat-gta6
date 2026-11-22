[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/gta6-01)

# Vice Heat — 开放世界罪恶都市

An original open-world crime game built for the [Make GTA 6](https://make.fun/bounty/gta6-01) bounty on make.fun. Top-down 2D, playable offline in a desktop browser — no network requests, no Rockstar / GTA names, characters, maps, art or music. Everything is original.

## Play offline

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` directly in desktop Chrome (ES modules load from local files when served; use the command above for the reliable path).

## The game

Explore a varied, non-grid seaside city — a diagonal avenue, a curved coastal ring road, a central park with a lake, a night-market square, a port/industrial area, a residential district, glass high-rises downtown, a beach and a wooden pier. Walk and drive, steal cars, dodge the police, fight, shop and collect.

- **World:** ~30 offset intersections, ~60 road segments, traffic that drives the road network, wandering pedestrians, 20 hidden packages.
- **Wanted 1–5★:** stealing cars, shooting, hitting pedestrians and attacking police raise your wanted level. Police cars chase, 4★ brings roadblocks, 5★ brings a helicopter searchlight. Break line of sight for ~7s to lose a star; a car-shop respray clears all stars. Caught on foot ≈ busted; HP zero ≈ wasted.
- **Story — 6 chapters** (take each one at 龙叔酒吧, the pink dot, with E): get a pistol at the east gun shop; steal a pink sports car; a street fight with 7 gang members at the night market; a 150-second truck delivery to 4 points in the marked yellow quest truck; stop an armoured truck, grab the green money bag and lose the police; hold the bank vault for 45 seconds, lose the police and exfiltrate to the south dock. Ending screen, then free roam.
- **Combat & shops:** fists / pistol / SMG / shotgun, hit markers, enemy health bars, screen shake; gun shop, hospital (heal) and car shop (respray/repair).
- **HUD & saves:** health/armour/money/reputation/clock, minimap with shops/objectives/police and a north marker, weapon/ammo, speedometer while driving, district names, completion % and run stats. 3 in-memory save slots per page session, plus export/import of a save file (no localStorage).

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move / drive |
| Mouse | Aim |
| Left click | Fire |
| E | Enter car / carjack / talk / buy / accept mission |
| Shift | Sprint |
| Space | Handbrake |
| 1 / 2 / 3 / 4 | Switch weapon (fist / pistol / SMG / shotgun) |
| H | Horn |
| M | Radio (synthesised) |
| Esc / P | Pause |

You cannot shoot from inside a car. The cyan car by the bar is yours — driving it does not count as stealing.

## Files

- `game/index.html` + `game/src/world.js` (city) + `game/src/main.js` (game)
- `main.ts` — entry program, copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — real renders from running the game
- `serve.ts` — tiny local static server for development

## License

MIT — see `LICENSE`.
