import { useState, useCallback, useMemo } from "react";
import FacilityMap from "./components/FacilityMap";
import Sidebar from "./components/Sidebar";
import { applyChange } from "./utils/applyChange";
import UnitModal from "./components/UnitModal";

function App() {
  const [params, setParams] = useState({
    baseInCone: 150,
    baseOutCone: 55,
    crossPenalty: 50,
    halfConeDeg: 30,
  });
  const [unitModalUnit, setUnitModalUnit] = useState({});
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [layout, setLayout] = useState({
    canvasSize: { width: 1200, height: 800 },
    units: [],
  });

  const cosHalfAngle = useMemo(
    () => Math.cos((params.halfConeDeg * Math.PI) / 180),
    [params.halfConeDeg]
  );
  const handleUpdate = useCallback((type, id, props) => {
    setLayout((prev) => applyChange(prev, type, id, props));
  }, []);

  const handleSaveUnit = useCallback((updatedUnit) => {
    setLayout((prev) => ({
      ...prev,
      units: prev.units.map((u) =>
        u.id === updatedUnit.id ? { ...u, ...updatedUnit } : u
      ),
    }));
  }, []);

  const handleParamChange = (field) => (e) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    setParams((p) => ({ ...p, [field]: val }));
  };
  return (
    <div className="flex h-screen bg-gray-100 ">
      {isUnitModalOpen && (
        <UnitModal
          unit={unitModalUnit}
          onSave={handleSaveUnit}
          setIsUnitModalOpen={setIsUnitModalOpen}
        />
      )}
      <Sidebar
        layout={layout}
        setLayout={setLayout}
        handleParamChange={handleParamChange}
        params={params}
      />
      <div
        className={`p-2 h-[${layout.canvasSize.height}] w-[${layout.canvasSize.width}]`}
      >
        <FacilityMap
          layout={layout}
          params={params}
          onUpdate={handleUpdate}
          setUnitModalUnit={setUnitModalUnit}
          setIsUnitModalOpen={setIsUnitModalOpen}
          setLayout={setLayout}
          cosHalfAngle={cosHalfAngle}
        />
      </div>
    </div>
  );
}

export default App;
