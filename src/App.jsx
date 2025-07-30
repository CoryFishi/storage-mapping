import { useState, useCallback } from "react";
import FacilityMap from "./components/FacilityMap";
import Sidebar from "./components/Sidebar";
import { applyChange } from "./utils/applyChange";
import UnitModal from "./components/UnitModal";

function App() {
  const [layout, setLayout] = useState({
    canvasSize: { width: 1200, height: 800 },
    units: [
      {
        id: "65b489be-1c7c-4a79-b00f-31487cbefc4f",
        label: "Unit A0",
        x: 250,
        y: 150,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "63cf173c-8f41-4f0b-b2dc-f61b2c7e0a5e",
        label: "Unit A1",
        x: 325,
        y: 150,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "869b3102-d8bd-474f-bf62-d94fd725edc1",
        label: "Unit A2",
        x: 400,
        y: 150,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "0209fa40-6cec-4d32-b9d2-686b3a1afee2",
        label: "Unit A3",
        x: 475,
        y: 150,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },

      {
        id: "a1f9d906-7e9c-4f75-aa89-5d2e6cbb9c88",
        label: "Unit B0",
        x: 250,
        y: 300,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "d82b3c13-1af4-4f3d-a5e1-2beb4f2622f0",
        label: "Unit B1",
        x: 325,
        y: 300,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "c7e8ff2e-4b5e-4c7b-b0d9-91f6f7d9bb52",
        label: "Unit B2",
        x: 400,
        y: 300,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "58f3d2e7-0bfc-4b02-9f7c-3d2c5f40d9ac",
        label: "Unit B3",
        x: 475,
        y: 300,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "e5a1c3d2-8f6b-4f34-9a1c-1b0d3a4f6c8d",
        label: "Unit C0",
        x: 650,
        y: 150,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "left", locked: true }],
      },
      {
        id: "f3b0a1c4-7e8d-4a2b-b3c4-5d6e7f8a9b0c",
        label: "Unit C1",
        x: 650,
        y: 225,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "left", locked: true }],
      },
      {
        id: "9c8b7a6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
        label: "Unit C2",
        x: 650,
        y: 300,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "left", locked: true }],
      },
      {
        id: "7d6c5b4a-3f2e-1d0c-9b8a-7d6c5b4a3f2e",
        label: "Unit C3",
        x: 650,
        y: 375,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "left", locked: true }],
      },
      {
        id: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
        label: "Unit D0",
        x: 800,
        y: 150,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
        label: "Unit D1",
        x: 875,
        y: 225,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
        label: "Unit D2",
        x: 950,
        y: 300,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
      {
        id: "4d5e6f7a-8b9c-0d1e-2f3a-4b5c6d7e8f9a",
        label: "Unit D3",
        x: 1025,
        y: 375,
        width: 75,
        height: 75,
        color: "#e5e7eb",
        doors: [{ side: "bottom", locked: true }],
      },
    ],

    equipment: [],
  });
  const [unitModalUnit, setUnitModalUnit] = useState({});
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
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
  return (
    <div className="flex h-screen bg-gray-100 ">
      {isUnitModalOpen && (
        <UnitModal
          unit={unitModalUnit}
          onSave={handleSaveUnit}
          setIsUnitModalOpen={setIsUnitModalOpen}
        />
      )}
      <Sidebar layout={layout} setLayout={setLayout} />
      <div
        className={`p-2 h-[${layout.canvasSize.height}] w-[${layout.canvasSize.width}]`}
      >
        <FacilityMap
          layout={layout}
          onUpdate={handleUpdate}
          setUnitModalUnit={setUnitModalUnit}
          setIsUnitModalOpen={setIsUnitModalOpen}
          setLayout={setLayout}
        />
      </div>
    </div>
  );
}

export default App;
