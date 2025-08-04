import layoutUnits from "../utils/facility1.json";
import { useMemo, useState } from "react";
import CreateUnitModal from "./CreateUnitModal";
import { v4 as uuid } from "uuid";

export default function Sidebar({
  layout,
  setLayout,
  handleParamChange,
  params,
}) {
  const [isCreateUnitModalOpen, setIsCreateUnitModalOpen] = useState(false);

  const PX_PER_FT = 5;

  // Helper to add an access point (e.g., put at center or anywhere)
  const addAccessPoint = (
    x = layout.canvasSize.width / 2,
    y = layout.canvasSize.height / 2
  ) => {
    setLayout((prev) => ({
      ...prev,
      accessPoints: [
        ...(prev.accessPoints || []),
        {
          id: uuid(),
          label: `AP ${(prev.accessPoints?.length || 0) + 1}`,
          x,
          y,
          range: 250, // px
          color: "#22c55e", // greenish
        },
      ],
    }));
  };

  const totals = useMemo(() => {
    let totalUnits = layout.units.length;
    let totalRentableAreaFt2 = 0;
    let totalDoors = 0;
    let totalLocks = 0;

    for (const u of layout.units) {
      // area in ft²
      const areaFt2 =
        (u.width / PX_PER_FT) *
        (u.height / PX_PER_FT) *
        (u.shape === "rightTriangle" ? 0.5 : 1);
      totalRentableAreaFt2 += areaFt2;

      const doors = u.doors || [];
      totalDoors += doors.length;
      totalLocks += doors.filter((d) => d.locked).length;
    }

    return {
      totalUnits,
      totalRentableAreaFt2,
      totalDoors,
      totalLocks,
    };
  }, [layout.units]);

  const loadLayout1 = () => {
    setLayout((prev) => ({
      ...prev,
      units: layoutUnits,
      canvasSize: prev.canvasSize,
      equipment: prev.equipment ?? [],
    }));
  };
  const gridSize = 25;
  const snap = (v) => Math.round(v / gridSize) * gridSize;
  const handleCreateUnitSave = (unit) => {
    setLayout((prev) => {
      // enforce minimum size and snap everything to grid
      const width = Math.max(snap(unit.width), gridSize);
      const height = Math.max(snap(unit.height), gridSize);
      const x = snap(unit.x);
      const y = snap(unit.y);
      const wallMultiplier = Math.max(1, Number(unit.wallMultiplier) || 1);

      const normalized = {
        ...unit,
        width,
        height,
        x,
        y,
        wallMultiplier,
        // ensure doors array is well-formed
        doors: (unit.doors || []).map((d) => ({
          side: d.side,
          locked: !!d.locked,
        })),
      };

      return {
        ...prev,
        units: [...prev.units, normalized],
      };
    });
  };

  return (
    <div className="h-screen w-64 bg-gray-100 border-r p-4 space-y-4">
      {isCreateUnitModalOpen && (
        <CreateUnitModal
          setIsCreateUnitModalOpen={setIsCreateUnitModalOpen}
          units={layout.units}
          onSave={handleCreateUnitSave}
        />
      )}
      <div className="flex flex-col gap-2 flex-wrap">
        <button
          onClick={() => setIsCreateUnitModalOpen(true)}
          className="w-full py-2 bg-blue-600 text-white rounded"
        >
          Create New Unit
        </button>

        <button
          onClick={loadLayout1}
          className="w-full py-2 bg-blue-600 text-white rounded"
        >
          Set Facility Layout 1
        </button>
      </div>
      <button
        className="absolute top-72 right-2 z-20 bg-indigo-600 text-white px-3 py-1 rounded"
        onClick={() => addAccessPoint()}
      >
        Add Access Point
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
      <div className="flex flex-col gap-1 text-sm">
        <h2>
          <span>Total Units:</span> {totals.totalUnits}
        </h2>
        <h2>
          <span>Total Rentable Space:</span>{" "}
          {Math.round(totals.totalRentableAreaFt2 * 100) / 100} ft²
        </h2>
        <h2>
          <span>Total Doors:</span> {totals.totalDoors}
        </h2>
        <h2>
          <span>Total Locks:</span> {totals.totalLocks}
        </h2>
      </div>
    </div>
  );
}
