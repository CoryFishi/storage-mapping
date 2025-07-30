export function applyChange(layout, type, id, props) {
  switch (type) {
    case "moveUnit":
    case "resizeUnit":
      return {
        ...layout,
        units: layout.units.map((u) => (u.id === id ? { ...u, ...props } : u)),
      };

    case "moveEquip":
      return {
        ...layout,
        equipment: layout.equipment.map((e) =>
          e.id === id ? { ...e, ...props } : e
        ),
      };
    case "addDoor":
      return {
        ...layout,
        units: layout.units.map((u) =>
          u.id === id
            ? {
                ...u,
                doors: [
                  ...(u.doors || []),
                  { side: props.side, locked: false },
                ],
              }
            : u
        ),
      };
    default:
      return layout;
  }
}
