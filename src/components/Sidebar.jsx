import { v4 as uuid } from "uuid";
import layoutUnits from "../utils/facility1.json";

export default function Sidebar({
  layout,
  setLayout,
  handleParamChange,
  params,
}) {
  const makeLabel = () => `Unit ${layout.units.length}`;

  const addUnit = ({
    width = 50,
    height = 50,
    type = "Square",
    shape = "square",
    orientation = "nw",
    wallMultiplier = 1,
  }) => {
    const newUnit = {
      id: uuid(),
      label: makeLabel(),
      type,
      shape,
      orientation,
      wallMultiplier,
      x: 0,
      y: 0,
      width,
      height,
      color: "#e5e7eb",
      doors: [],
    };
    setLayout((prev) => ({
      ...prev,
      units: [...prev.units, newUnit],
    }));
  };

  const addRightTriangle = (orient) => {
    const valid = ["nw", "ne", "se", "sw"].includes(orient) ? orient : "nw";
    addUnit({
      width: 50,
      height: 50,
      type: "RightTriangle",
      shape: "rightTriangle",
      orientation: valid,
      wallMultiplier: 1,
    });
  };

  const addThickSquare = () => {
    addUnit({
      width: 50,
      height: 50,
      type: "Square",
      shape: "square",
      wallMultiplier: 2, // thicker wall
    });
  };

  const loadLayout1 = () => {
    setLayout((prev) => ({
      ...prev,
      units: layoutUnits,
      canvasSize: prev.canvasSize,
      equipment: prev.equipment ?? [],
    }));
  };

  return (
    <div className="w-64 bg-gray-100 border-r p-4 space-y-4">
      <button
        onClick={() => addUnit({ width: 50, height: 50, type: "Square" })}
        className="w-full py-2 bg-blue-600 text-white rounded"
      >
        Add Square Unit (10x10)
      </button>
      <button
        onClick={() => addRightTriangle("nw")}
        className="w-full py-2 bg-blue-600 text-white rounded"
      >
        Add NW Right Triangle Unit
      </button>
      <button
        onClick={() => addRightTriangle("ne")}
        className="w-full py-2 bg-blue-600 text-white rounded"
      >
        Add NE Right Triangle Unit
      </button>
      <button
        onClick={() => addRightTriangle("se")}
        className="w-full py-2 bg-blue-600 text-white rounded"
      >
        Add SE Right Triangle Unit
      </button>
      <button
        onClick={() => addRightTriangle("sw")}
        className="w-full py-2 bg-blue-600 text-white rounded"
      >
        Add SW Right Triangle Unit
      </button>
      <button
        onClick={addThickSquare}
        className="w-full py-2 bg-blue-600 text-white rounded"
      >
        Add Thick-Walled Square
      </button>
      <button
        onClick={loadLayout1}
        className="w-full py-2 bg-blue-600 text-white rounded"
      >
        Set Facility Layout 1
      </button>
      <div className="flex flex-col gap-1">
        <label className="text-xs">
          In-cone range (ft)
          <input
            type="number"
            value={params.baseInCone}
            onChange={handleParamChange("baseInCone")}
            className="w-full border px-1 rounded"
          />
        </label>
        <label className="text-xs">
          Out-of-cone range (ft)
          <input
            type="number"
            value={params.baseOutCone}
            onChange={handleParamChange("baseOutCone")}
            className="w-full border px-1 rounded"
          />
        </label>
        <label className="text-xs">
          Cross penalty (ft)
          <input
            type="number"
            value={params.crossPenalty}
            onChange={handleParamChange("crossPenalty")}
            className="w-full border px-1 rounded"
          />
        </label>
        <label className="text-xs">
          Half cone angle (deg)
          <input
            type="number"
            value={params.halfConeDeg}
            onChange={handleParamChange("halfConeDeg")}
            className="w-full border px-1 rounded"
          />
        </label>
      </div>
    </div>
  );
}
