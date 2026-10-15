<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the imported Solaris simulation in src/game and mount it through a client-only TanStack index route; its canvas and existing local saves depend on browser APIs.
- Use cached spherical terrain and world-space stellar lighting for planet rendering; preserve the uploaded simulation physics and tools.
- Keep strict TypeScript with the uploaded game's indexed-array and optional-property compatibility settings; the existing simulation uses bounded numeric arrays extensively.
- Interpret attached planet orbit distances as world units and moon orbit distances as parent-radius multiples; this keeps generated stellar systems at their intended spacing.
- Resolve canvas label ink from the global foreground token using canvasText; the interface and canvas must share their text theme.
- Generate distant stellar centers on an equal-area golden-angle spiral outside the local Solar System, with expanded local planet orbits; this prevents crowding at every universe-size setting.
- Store simulation Options in the existing local preference schema and apply them when starting or loading a universe; this keeps controls consistent with the imported game's local saves.
- Render stellar textures from world-space sphere normals and exotic disks/mouths from fixed object-local axes with perspective and depth ordering; this removes billboarding while preserving the imported Canvas simulation.