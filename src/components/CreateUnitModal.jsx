import { useState, useMemo } from "react";
import { v4 as uuid } from "uuid";
import {
  Stage,
  Layer,
  Rect,
  Line,
  Circle,
  Group,
  Text as KText,
} from "react-konva";

const PX_PER_FT = 5;

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

  const toFeetDisplay = (px) => Math.round((px / PX_PER_FT) * 10) / 10;

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

  // triangle helpers
  const getTriangleCorners = (unit) => {
    switch (unit.orientation) {
      case "nw":
        return [
          { x: 0, y: 0 }, // right angle
          { x: unit.width, y: 0 },
          { x: 0, y: unit.height },
        ];
      case "ne":
        return [
          { x: unit.width, y: 0 }, // right angle
          { x: 0, y: 0 },
          { x: unit.width, y: unit.height },
        ];
      case "se":
        return [
          { x: unit.width, y: unit.height }, // right angle
          { x: unit.width, y: 0 },
          { x: 0, y: unit.height },
        ];
      case "sw":
        return [
          { x: 0, y: unit.height }, // right angle
          { x: 0, y: 0 },
          { x: unit.width, y: unit.height },
        ];
      default:
        return [
          { x: 0, y: 0 },
          { x: unit.width, y: 0 },
          { x: 0, y: unit.height },
        ];
    }
  };
  const hasTriangleSide = (orientation, side) => {
    const mapping = {
      nw: ["top", "left", "hypotenuse"],
      ne: ["top", "right", "hypotenuse"],
      se: ["bottom", "right", "hypotenuse"],
      sw: ["bottom", "left", "hypotenuse"],
    };
    return mapping[orientation]?.includes(side);
  };
  const getTriangleLockPos = (unit, door) => {
    const orient = unit.orientation || "nw";
    if (!hasTriangleSide(orient, door.side)) return null;
    const barTh = 4;

    if (door.side === "top" || door.side === "bottom") {
      const barLen = unit.width * 0.8;
      const x = (unit.width - barLen) / 2;
      const y = door.side === "top" ? -barTh / 2 : unit.height - barTh / 2;
      return {
        x: x + barLen * (door.side === "bottom" ? 0.8 : 0.2),
        y: y + 2,
      };
    }

    if (door.side === "left" || door.side === "right") {
      const barLen = unit.height * 0.8;
      const x = door.side === "left" ? -barTh / 2 : unit.width - barTh / 2;
      const y = (unit.height - barLen) / 2;
      return {
        x: x + 2,
        y: y + barLen * (door.side === "left" ? 0.8 : 0.2),
      };
    }

    if (door.side === "hypotenuse") {
      switch (orient) {
        case "nw":
          return { x: unit.width - unit.width / 4.2, y: unit.height / 4.2 };
        case "ne":
          return {
            x: unit.width - unit.width / 4.2,
            y: unit.height - unit.height / 4.2,
          };
        case "sw":
          return { x: unit.width / 4.2, y: unit.height / 4.2 };
        case "se":
          return {
            x: unit.width / 4.2,
            y: unit.height - unit.height / 4.2,
          };
        default:
          return { x: unit.width - unit.width / 4.2, y: unit.height / 4.2 };
      }
    }
    return null;
  };

  // keep type/shape sync
  const setShape = (shape) => {
    setNewUnit((prev) => ({
      ...prev,
      shape,
      type: shape === "square" ? "Square" : "Triangle",
      doors: [],
    }));
  };
  const setOrientation = (o) => {
    setNewUnit((prev) => ({ ...prev, orientation: o, doors: [] }));
  };

  // Preview sizing
  const PREVIEW_SIZE = 200;
  const previewScale = useMemo(() => {
    const maxDim = Math.max(newUnit.width, newUnit.height);
    return maxDim > 0 ? (PREVIEW_SIZE - 20) / maxDim : 1;
  }, [newUnit.width, newUnit.height]);

  return (
    <div className="h-screen w-screen fixed gap-2 inset-0 z-50 flex flex-wrap items-center justify-center bg-black/50">
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
              {["top", "right", "bottom", "left", "hypotenuse"].map((side) => {
                const active = newUnit.doors?.some((d) => d.side === side);
                if (newUnit.shape === "square" && side === "hypotenuse")
                  return null;
                if (
                  newUnit.shape === "rightTriangle" &&
                  !hasTriangleSide(newUnit.orientation, side)
                )
                  return null;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => toggleDoor(side)}
                    className={`px-3 py-1 border rounded text-sm ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
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
                    className={`px-3 py-1 border rounded text-sm ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
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

      {/* Live Preview */}
      <div className="bg-white rounded p-2 border flex flex-col items-center justify-center">
        <div className="text-xs font-medium mb-1">Preview</div>
        <Stage
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          style={{ background: "#f9f9f9" }}
        >
          <Layer>
            <Group
              x={PREVIEW_SIZE / 2}
              y={PREVIEW_SIZE / 2}
              scaleX={previewScale}
              scaleY={previewScale}
            >
              {/* Position unit so its top-left is centered */}
              <Group
                x={-newUnit.width / 2}
                y={-newUnit.height / 2}
                listening={false}
              >
                {/* Body */}
                {newUnit.shape === "rightTriangle" ? (
                  <Line
                    points={getTriangleCorners(newUnit)
                      .flatMap((p) => [p.x, p.y])
                      .concat([
                        getTriangleCorners(newUnit)[0].x,
                        getTriangleCorners(newUnit)[0].y,
                      ])} // close
                    fill={newUnit.color}
                    stroke="#333"
                    strokeWidth={2 * newUnit.wallMultiplier}
                    closed
                  />
                ) : (
                  <Rect
                    width={newUnit.width}
                    height={newUnit.height}
                    fill={newUnit.color}
                    stroke="#333"
                    strokeWidth={2 * newUnit.wallMultiplier}
                  />
                )}

                {/* Doors & locks */}
                {(newUnit.doors || []).map((door, i) => {
                  const barTh = 4;
                  let doorBar = null;
                  let lockPos = null;

                  if (newUnit.shape === "rightTriangle") {
                    // triangle-specific
                    if (!hasTriangleSide(newUnit.orientation, door.side))
                      return null;

                    if (door.side === "top") {
                      const barLen = newUnit.width * 0.8;
                      const x = (newUnit.width - barLen) / 2;
                      const y = -barTh / 2;
                      doorBar = (
                        <Rect
                          x={x}
                          y={y}
                          width={barLen}
                          height={barTh}
                          fill="#555"
                          cornerRadius={2}
                        />
                      );
                    } else if (door.side === "bottom") {
                      const barLen = newUnit.width * 0.8;
                      const x = (newUnit.width - barLen) / 2;
                      const y = newUnit.height - barTh / 2;
                      doorBar = (
                        <Rect
                          x={x}
                          y={y}
                          width={barLen}
                          height={barTh}
                          fill="#555"
                          cornerRadius={2}
                        />
                      );
                    } else if (door.side === "left") {
                      const barLen = newUnit.height * 0.8;
                      const x = -barTh / 2;
                      const y = (newUnit.height - barLen) / 2;
                      doorBar = (
                        <Rect
                          x={x}
                          y={y}
                          width={barTh}
                          height={barLen}
                          fill="#555"
                          cornerRadius={2}
                        />
                      );
                    } else if (door.side === "right") {
                      const barLen = newUnit.height * 0.8;
                      const x = newUnit.width - barTh / 2;
                      const y = (newUnit.height - barLen) / 2;
                      doorBar = (
                        <Rect
                          x={x}
                          y={y}
                          width={barTh}
                          height={barLen}
                          fill="#555"
                          cornerRadius={2}
                        />
                      );
                    } else if (door.side === "hypotenuse") {
                      const corners = getTriangleCorners(newUnit);
                      const p1 = corners[1];
                      const p2 = corners[2];
                      const midX = (p1.x + p2.x) / 2;
                      const midY = (p1.y + p2.y) / 2;
                      const deltaX = p2.x - p1.x;
                      const deltaY = p2.y - p1.y;
                      const fullLen = Math.hypot(deltaX, deltaY);
                      const length = fullLen * 0.8;
                      const angleDeg =
                        (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
                      doorBar = (
                        <Rect
                          x={midX}
                          y={midY}
                          width={length}
                          height={barTh}
                          offsetX={length / 2}
                          offsetY={barTh / 2}
                          rotation={angleDeg}
                          fill="#555"
                          cornerRadius={2}
                        />
                      );
                    }
                    lockPos = getTriangleLockPos(newUnit, door);
                  } else {
                    // square
                    const barLen = newUnit.width * 0.8;
                    let x, y, w, h;
                    switch (door.side) {
                      case "top":
                        w = barLen;
                        h = barTh;
                        x = (newUnit.width - w) / 2;
                        y = -h / 2;
                        break;
                      case "bottom":
                        w = barLen;
                        h = barTh;
                        x = (newUnit.width - w) / 2;
                        y = newUnit.height - h / 2;
                        break;
                      case "left":
                        w = barTh;
                        h = newUnit.height * 0.8;
                        x = -w / 2;
                        y = (newUnit.height - h) / 2;
                        break;
                      case "right":
                        w = barTh;
                        h = newUnit.height * 0.8;
                        x = newUnit.width - w / 2;
                        y = (newUnit.height - h) / 2;
                        break;
                      default:
                        break;
                    }
                    doorBar = (
                      <Rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill="#555"
                        cornerRadius={2}
                      />
                    );
                    lockPos = {
                      x:
                        door.side === "bottom"
                          ? x + w * 0.8
                          : door.side === "top"
                          ? x + w * 0.2
                          : x + 2,
                      y:
                        door.side === "left"
                          ? y + h * 0.8
                          : door.side === "right"
                          ? y + h * 0.2
                          : y + 2,
                    };
                  }

                  return (
                    <Group key={i}>
                      {doorBar}
                      {door.locked && lockPos && (
                        <Circle
                          x={lockPos.x}
                          y={lockPos.y}
                          radius={6}
                          fill="blue"
                        />
                      )}
                    </Group>
                  );
                })}
                {/* label inside preview */}
                <KText
                  text={newUnit.label}
                  fontSize={12}
                  width={newUnit.width}
                  height={newUnit.height}
                  align="center"
                  verticalAlign="middle"
                  listening={false}
                  y={0}
                />
              </Group>
            </Group>
          </Layer>
        </Stage>
        <div className="text-[10px] mt-1">
          {toFeetDisplay(newUnit.width)}×{toFeetDisplay(newUnit.height)} ft
        </div>
      </div>
    </div>
  );
}
