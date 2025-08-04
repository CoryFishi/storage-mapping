import { useState } from "react";

const PX_PER_FT = 5;

export default function EditAccessPointModal({
  accesspoint,
  setIsEditAccessPointModalOpen,
  onSave,
}) {
  const [newAccessPoint, setNewAccessPoint] = useState({ ...accesspoint });
  const toFeetDisplay = (px) => {
    return Math.round((px / PX_PER_FT) * 10) / 10;
  };
  const handleChange = (field) => (e) => {
    const raw = e.target.value;
    if (["width", "height", "x", "y"].includes(field)) {
      const val = parseFloat(raw);
      if (isNaN(val)) return;
      // convert feet → pixels
      const px = Math.round(val * PX_PER_FT);
      setNewAccessPoint((prev) => ({ ...prev, [field]: px }));
    } else {
      setNewAccessPoint((prev) => ({ ...prev, [field]: raw }));
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 bg-white rounded p-4 border">
        <h2 className="font-semibold text-center mb-4">
          Edit {accesspoint.id}
        </h2>
        <div className="space-y-3">
          {/* Label */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Label</label>
            <input
              type="text"
              value={newAccessPoint.label}
              onChange={handleChange("label")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* X Pos */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">X Pos</label>
            <input
              type="number"
              value={toFeetDisplay(newAccessPoint.x)}
              onChange={handleChange("x")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* Y Pos */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Y Pos</label>
            <input
              type="number"
              value={toFeetDisplay(newAccessPoint.y)}
              onChange={handleChange("y")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* Show Range */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Show Range</label>
            <input
              type="checkbox"
              checked={newAccessPoint.showRange}
              onChange={() =>
                setNewAccessPoint((prev) => ({
                  ...prev,
                  showRange: !prev.showRange,
                }))
              }
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* Y Pos */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Y Pos</label>
            <input
              type="number"
              value={toFeetDisplay(newAccessPoint.y)}
              onChange={handleChange("y")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* Color */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Color</label>
            <input
              type="color"
              value={newAccessPoint.color}
              onChange={handleChange("color")}
              className="w-2/3 h-10 rounded"
            />
          </div>
        </div>

        <div className="flex justify-evenly mt-6">
          <button
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            onClick={() => {
              onSave(newAccessPoint);
              setIsEditAccessPointModalOpen(false);
            }}
          >
            Save
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            onClick={() => setIsEditAccessPointModalOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
