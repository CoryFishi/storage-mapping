import { useState } from "react";

const PX_PER_FT = 5;

export default function UnitModal({ unit, setIsUnitModalOpen, onSave }) {
  const [newUnit, setNewUnit] = useState({ ...unit });
  const toFeetDisplay = (px) => {
    return Math.round((px / PX_PER_FT) * 10) / 10;
  };
  // update helpers
  const handleChange = (field) => (e) => {
    const raw = e.target.value;
    if (["width", "height", "x", "y"].includes(field)) {
      const val = parseFloat(raw);
      if (isNaN(val)) return;
      // convert feet → pixels
      const px = Math.round(val * PX_PER_FT);
      setNewUnit((prev) => ({ ...prev, [field]: px }));
    } else {
      setNewUnit((prev) => ({ ...prev, [field]: raw }));
    }
  };

  const toggleDoor = (side) => {
    setNewUnit((prev) => {
      const has = prev.doors?.some((d) => d.side === side);
      const doors = has
        ? prev.doors.filter((d) => d.side !== side)
        : [...(prev.doors || []), { side }];
      return { ...prev, doors };
    });
  };

  const sides = ["top", "right", "bottom", "left", "hypotenuse"];
  const TRIANGLE_ALLOWED = {
    nw: ["top", "left", "hypotenuse"],
    ne: ["top", "right", "hypotenuse"],
    se: ["bottom", "right", "hypotenuse"],
    sw: ["bottom", "left", "hypotenuse"],
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 bg-white rounded p-4 border">
        <h2 className="font-semibold text-center mb-4">Edit Unit {unit.id}</h2>

        <div className="space-y-3">
          {/* Label */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Label</label>
            <input
              type="text"
              value={newUnit.label}
              onChange={handleChange("label")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>

          {/* Width */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Width</label>
            <input
              type="number"
              value={toFeetDisplay(newUnit.width)}
              onChange={handleChange("width")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>

          {/* Height */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Height</label>
            <input
              type="number"
              value={toFeetDisplay(newUnit.height)}
              onChange={handleChange("height")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>

          {/* X Pos */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">X Pos</label>
            <input
              type="number"
              value={toFeetDisplay(newUnit.x)}
              onChange={handleChange("x")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>

          {/* Y Pos */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Y Pos</label>
            <input
              type="number"
              value={toFeetDisplay(newUnit.y)}
              onChange={handleChange("y")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>

          {/* Color */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Color</label>
            <input
              type="color"
              value={newUnit.color}
              onChange={handleChange("color")}
              className="w-2/3 h-10 rounded"
            />
          </div>

          <div className="mt-4">
            <div className="text-center font-medium mb-1">Doors</div>
            <div className="flex justify-center gap-2">
              {sides.map((side) => {
                const active = newUnit.doors?.some((d) => d.side === side);

                // square doesn't get a hypotenuse side
                if (newUnit.shape === "Square" && side === "hypotenuse")
                  return null;
                if (newUnit.shape === "square" && side === "hypotenuse")
                  return null;

                // triangle: only allow sides valid for its orientation
                if (newUnit.shape === "rightTriangle") {
                  const orient = newUnit.orientation || "nw"; // default if missing
                  if (!TRIANGLE_ALLOWED[orient]?.includes(side)) return null;
                }

                return (
                  <button
                    key={side}
                    onClick={() => toggleDoor(side)}
                    className={`
        px-3 py-1 border rounded
        ${active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}
      `}
                  >
                    {side.charAt(0).toUpperCase() + side.slice(1)}
                  </button>
                );
              })}
            </div>
            <div className="text-center font-medium mb-1">Locks</div>
            <div className="flex justify-center gap-2">
              {(newUnit.doors || []).map((door, i) => {
                const active = door.locked;
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setNewUnit((prev) => ({
                        ...prev,
                        doors: prev.doors.map((d) =>
                          d.side === door.side ? { ...d, locked: !d.locked } : d
                        ),
                      }));
                    }}
                    className={`
            px-3 py-1 border rounded
            ${active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}
          `}
                  >
                    {door.side.charAt(0).toUpperCase() + door.side.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-evenly mt-6">
          <button
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            onClick={() => {
              onSave(newUnit);
              setIsUnitModalOpen(false);
            }}
          >
            Save
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            onClick={() => setIsUnitModalOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
