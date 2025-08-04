import layoutUnits from "../utils/facility1.json";
import { useMemo, useState } from "react";
import CreateUnitModal from "./CreateUnitModal";
import { v4 as uuid } from "uuid";
import {
  TbLayoutSidebarLeftCollapseFilled,
  TbLayoutSidebarRightCollapseFilled,
} from "react-icons/tb";
import CreateWallModal from "./CreateWallModal";
export default function Sidebar({
  layout,
  setLayout,
  findNearbyLocks,
  limitNearest,
  setLimitNearest,
  proximityText,
  setProximityText,
  setProximityPairs,
  getAllLocks,
  computeReachability,
}) {
  const [isCreateUnitModalOpen, setIsCreateUnitModalOpen] = useState(false);
  const [isCreateWallModalOpen, setIsCreateWallModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
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
          range: 750,
          showRange: false,
          color: "#22c55e",
        },
      ],
    }));
  };

  const totals = useMemo(() => {
    let totalUnits = layout.units.length;
    let totalRentableAreaFt2 = 0;
    let totalDoors = 0;
    let totalLocks = 0;
    let totalAccessPoints = layout.accessPoints?.length || 0;

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
      totalAccessPoints,
    };
  }, [layout]);

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

  const handleCreateWallSave = (wall) => {
    setLayout((prev) => {
      // enforce minimum size and snap everything to grid
      const x1 = snap(wall.x1);
      const y1 = snap(wall.y1);
      const x2 = snap(wall.x2);
      const y2 = snap(wall.y2);
      const thickness = Math.max(1, Number(wall.thickness) || 1);

      const normalized = {
        ...wall,
        x1,
        y1,
        x2,
        y2,
        thickness,
      };

      return {
        ...prev,
        walls: [...prev.walls, normalized],
      };
    });
  };

  return (
    <div
      className={`
        h-screen flex flex-col bg-gray-100 border-r relative
        ${isCollapsed ? "w-0" : "min-w-72 p-4"}
      `}
    >
      {isCreateUnitModalOpen && (
        <CreateUnitModal
          setIsCreateUnitModalOpen={setIsCreateUnitModalOpen}
          units={layout.units}
          onSave={handleCreateUnitSave}
        />
      )}
      {isCreateWallModalOpen && (
        <CreateWallModal
          setIsCreateWallModalOpen={setIsCreateWallModalOpen}
          walls={layout.walls}
          onSave={handleCreateWallSave}
        />
      )}
      <div
        className={`w-12 h-12 rounded-full absolute z-40 flex items-center justify-center cursor-pointer text-4xl top-9 bg-zinc-50 border ${
          isCollapsed ? "-right-6" : "-right-6"
        }`}
        onClick={() => setIsCollapsed((c) => !c)}
      >
        {isCollapsed ? (
          <TbLayoutSidebarRightCollapseFilled />
        ) : (
          <TbLayoutSidebarLeftCollapseFilled />
        )}
      </div>
      {!isCollapsed && (
        <>
          <div
            className="flex gap-2 items-center select-none justify-center mb-4"
            onClick={() => console.log(layout)}
          >
            <img src="map-pointer.svg" alt="" className="w-12 h-12" />
            <h2 className="text-xl font-bold">StorLock Mapping</h2>
          </div>
          {/* Buttons at the top */}
          <div className="flex flex-col gap-2 flex-wrap mb-4">
            <button
              onClick={() => setIsCreateUnitModalOpen(true)}
              className="w-full py-2 bg-blue-600 text-white rounded cursor-pointer"
            >
              Add Unit
            </button>
            <button
              className="w-full py-2 bg-blue-600 text-white rounded cursor-pointer"
              onClick={() => addAccessPoint()}
            >
              Add Access Point
            </button>
            <button
              onClick={() => setIsCreateWallModalOpen(true)}
              className="w-full py-2 bg-blue-600 text-white rounded cursor-pointer"
            >
              Add Wall
            </button>
            <button
              className="w-full py-2 bg-blue-600 text-white rounded cursor-pointer"
              onClick={findNearbyLocks}
            >
              Find Nearby Locks
            </button>

            <button
              className="w-full py-2 bg-blue-600 text-white rounded cursor-pointer"
              onClick={() => {
                const locks = getAllLocks();
                if (locks.length === 0) return;
                computeReachability(50);
              }}
            >
              Reachability from 50th Lock
            </button>
          </div>
          <div className="flex flex-col gap-2 mb-4">
            <button
              className={`w-full py-2  text-white rounded cursor-pointer ${
                proximityText
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
              onClick={() => setProximityText(!proximityText)}
            >
              Distance Calculation {proximityText ? "On" : "Off"}
            </button>
            <button
              className={`w-full py-2  text-white rounded cursor-pointer ${
                limitNearest
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
              onClick={() =>
                setLimitNearest(!limitNearest) & setProximityPairs([])
              }
              title="Limit distance lines to nearest 3 locks"
            >
              Limit Links {limitNearest ? "On" : "Off"}
            </button>
            <button
              className="w-full py-2 bg-blue-600 text-white rounded cursor-pointer"
              onClick={() => setProximityPairs([]) & console.log(layout.units)}
            >
              Clear Distance Lines
            </button>
          </div>
          <div className="flex flex-col">
            <button
              onClick={loadLayout1}
              className="w-full py-2 bg-blue-600 text-white rounded cursor-pointer"
            >
              Set Example Layout
            </button>
          </div>
          {/* Info at the bottom */}
          <div className="flex flex-col gap-1 text-sm mt-auto">
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
            <h2>
              <span>Total Access Points:</span> {totals.totalAccessPoints}
            </h2>
          </div>
        </>
      )}
    </div>
  );
}
