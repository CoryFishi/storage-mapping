import { useState, useMemo } from "react";
import { v4 as uuid } from "uuid";
import { Stage, Layer, Rect, Line, Circle, Group } from "react-konva";

const PX_PER_FT = 5;

export default function CreateWallModal({ setIsCreateWallModalOpen, onSave }) {
  const [newWall, setNewWall] = useState({
    id: uuid(),
    thickness: 2,
    x1: 25,
    y1: 25,
    x2: 50,
    y2: 50,
    color: "#333",
  });

  const toFeetDisplay = (px) => Math.round((px / PX_PER_FT) * 10) / 10;

  const handleNumericFeet = (field) => (e) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) return;
    setNewWall((prev) => ({ ...prev, [field]: Math.round(val * PX_PER_FT) }));
  };

  const handleChange = (field) => (e) => {
    setNewWall((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleWallThickness = (e) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val) || val <= 0) return;
    setNewWall((prev) => ({ ...prev, thickness: val }));
  };

  // Preview sizing
  const PREVIEW_SIZE = 200;
  const previewScale = useMemo(() => {
    const maxDim = Math.max(newWall.width, newWall.height);
    return maxDim > 0 ? (PREVIEW_SIZE - 20) / maxDim : 1;
  }, [newWall.width, newWall.height]);

  return (
    <div className="h-screen w-screen fixed gap-2 inset-0 z-50 flex flex-wrap items-center justify-center bg-black/50">
      <div className="w-96 bg-white rounded p-4 border">
        <h2 className="font-semibold text-center mb-4">Create New Wall</h2>
        <div className="flex flex-col gap-2">
          {/* Wall thickness */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Wall Thickness</label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={newWall.thickness}
              onChange={handleWallThickness}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* X Pos 1 (ft) */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">X Pos (ft)</label>
            <input
              type="number"
              step="0.1"
              value={toFeetDisplay(newWall.x1)}
              onChange={handleNumericFeet("x")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* Y Pos 1 (ft) */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Y Pos (ft)</label>
            <input
              type="number"
              step="0.1"
              value={toFeetDisplay(newWall.y1)}
              onChange={handleNumericFeet("y")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* X Pos 2 (ft) */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">X Pos (ft)</label>
            <input
              type="number"
              step="0.1"
              value={toFeetDisplay(newWall.x2)}
              onChange={handleNumericFeet("x")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* Y Pos 2 (ft) */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Y Pos (ft)</label>
            <input
              type="number"
              step="0.1"
              value={toFeetDisplay(newWall.y2)}
              onChange={handleNumericFeet("y")}
              className="border rounded px-2 py-1 w-2/3"
            />
          </div>
          {/* Color */}
          <div className="flex items-center">
            <label className="w-1/3 text-center">Color</label>
            <input
              type="color"
              value={newWall.color}
              onChange={handleChange("color")}
              className="w-2/3 h-10 rounded"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-evenly mt-6">
          <button
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
            onClick={() => {
              onSave(newWall);
              setIsCreateWallModalOpen(false);
            }}
          >
            Save
          </button>
          <button
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
            onClick={() => setIsCreateWallModalOpen(false)}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-white rounded p-2 border flex flex-col items-center justify-center">
        <div className="text-xs font-medium mb-1">Preview</div>
        <Stage
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          style={{ background: "#f9f9f9" }}
        >
          <Layer></Layer>
        </Stage>
        <div className="text-[10px] mt-1">
          {toFeetDisplay(newWall.width)}×{toFeetDisplay(newWall.height)} ft
        </div>
      </div>
    </div>
  );
}
