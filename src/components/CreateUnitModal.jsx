import { useState } from "react";
import { v4 as uuid } from "uuid";

const PX_PER_FT = 5; // global conversion

export default function CreateUnitModal({
  setIsCreateUnitModalOpen,
  onSave,
  units,
}) {
  const [newUnit, setNewUnit] = useState({
    label: `Unit ${units.length}`,
    id: uuid(),
    type: "Square",
    shape: "square",
    orientation: "nw",
    wallMultiplier: 1,
    x: 0,
    y: 0,
    width: 10 * PX_PER_FT,
    height: 10 * PX_PER_FT,
    color: "#e5e7eb",
    doors: [],
  });

  const toFeetDisplay = (px) => {
    return Math.round((px / PX_PER_FT) * 10) / 10;
  };

  const handleNumericFeet = (field) => (e) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    setNewUnit((prev) => ({ ...prev, [field]: Math.round(val * PX_PER_FT) }));
  };

  const handleChange = (field) => (e) => {
    setNewUnit((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleWallMultiplier = (e) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val) || val <= 0) return;
    setNewUnit((prev) => ({ ...prev, wallMultiplier: val }));
  };

  const toggleDoor = (side) => {
    setNewUnit((prev) => {
      const has = prev.doors?.some((d) => d.side === side);
      const doors = has
        ? prev.doors.filter((d) => d.side !== side)
        : [...(prev.doors || []), { side, locked: true }];
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

  // Synchronize type <-> shape
  const setShape = (shape) => {
    setNewUnit((prev) => ({
      ...prev,
      shape,
      type: shape === "square" ? "Square" : "Triangle",
    }));
    setNewUnit((prev) => ({ ...prev, doors: [] }));
  };

  const setOrientation = (o) => {
    setNewUnit((prev) => ({ ...prev, orientation: o }));
    setNewUnit((prev) => ({ ...prev, doors: [] }));
  };

  return (
    <div className="fixed gap-2 inset-0 z-50 flex flex-wrap items-center justify-center bg-black/50 p-4">
      <div className="w-96 bg-white rounded p-4 border">
        <h2 className="font-semibold text-center mb-4">Create New Unit</h2>
        <div className="flex flex-col gap-2">
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

          {/* Type / Shape */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Type</label>
            <select
              value={newUnit.shape}
              onChange={(e) => setShape(e.target.value)}
              className="border rounded px-2 py-1 w-2/3"
            >
              <option value="square">Square</option>
              <option value="rightTriangle">Right Triangle</option>
            </select>
          </div>

          {/* Orientation (only for triangles) */}
          {newUnit.shape === "rightTriangle" && (
            <div className="flex items-center">
              <label className="w-1/3 text-center">Orientation</label>
              <select
                value={newUnit.orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="border rounded px-2 py-1 w-2/3"
              >
                <option value="nw">NW (right angle top-left)</option>
                <option value="ne">NE (right angle top-right)</option>
                <option value="se">SE (right angle bottom-right)</option>
                <option value="sw">SW (right angle bottom-left)</option>
              </select>
            </div>
          )}

          {/* Wall multiplier */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Wall Multiplier</label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={newUnit.wallMultiplier}
              onChange={handleWallMultiplier}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>

          {/* Width (ft) */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Width (ft)</label>
            <input
              type="number"
              step="0.1"
              value={toFeetDisplay(newUnit.width)}
              onChange={handleNumericFeet("width")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>

          {/* Height (ft) */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Height (ft)</label>
            <input
              type="number"
              step="0.1"
              value={toFeetDisplay(newUnit.height)}
              onChange={handleNumericFeet("height")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>

          {/* X Pos (ft) */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">X Pos (ft)</label>
            <input
              type="number"
              step="0.1"
              value={toFeetDisplay(newUnit.x)}
              onChange={handleNumericFeet("x")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>

          {/* Y Pos (ft) */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Y Pos (ft)</label>
            <input
              type="number"
              step="0.1"
              value={toFeetDisplay(newUnit.y)}
              onChange={handleNumericFeet("y")}
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

          {/* Doors */}
          <div className="mt-2">
            <div className="text-center font-medium mb-1">Doors</div>
            <div className="flex flex-wrap justify-center gap-2">
              {sides.map((side) => {
                const active = newUnit.doors?.some((d) => d.side === side);

                if (newUnit.shape === "square" && side === "hypotenuse")
                  return null;
                if (newUnit.shape === "rightTriangle") {
                  if (!TRIANGLE_ALLOWED[newUnit.orientation]?.includes(side))
                    return null;
                }

                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => toggleDoor(side)}
                    className={`
                      px-3 py-1 border rounded text-sm
                      ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700"
                      }
                    `}
                  >
                    {side.charAt(0).toUpperCase() + side.slice(1)}
                  </button>
                );
              })}
            </div>

            <div className="text-center font-medium my-1">Locks</div>
            <div className="flex flex-wrap justify-center gap-2">
              {(newUnit.doors || []).map((door, i) => {
                const active = !!door.locked;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setNewUnit((prev) => ({
                        ...prev,
                        doors: prev.doors.map((d) =>
                          d.side === door.side ? { ...d, locked: !d.locked } : d
                        ),
                      }));
                    }}
                    className={`
                      px-3 py-1 border rounded text-sm
                      ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700"
                      }
                    `}
                  >
                    {door.side.charAt(0).toUpperCase() + door.side.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-evenly mt-6">
          <button
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            onClick={() => {
              onSave(newUnit);
              setIsCreateUnitModalOpen(false);
            }}
          >
            Save
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            onClick={() => setIsCreateUnitModalOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Optional live preview placeholder */}
      <div className="w-48 h-48 bg-white rounded p-4 border flex items-center justify-center">
        <div className="text-xs text-gray-600 text-center">
          Preview not implemented
        </div>
      </div>
    </div>
  );
}
