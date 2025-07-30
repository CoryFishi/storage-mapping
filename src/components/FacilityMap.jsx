import React, { useState, useRef, useEffect } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text,
  Group,
  Transformer,
  Circle,
  Line,
  Label,
  Tag,
} from "react-konva";
import { v4 as uuid } from "uuid";

const BASE_IN_CONE = 500; // ft
const BASE_OUT_CONE = 250; // ft
const CROSS_PENALTY = 140; // ft per crossed unit
const HALF_CONE_DEG = 30; // half-angle
const COS30 = Math.cos((HALF_CONE_DEG * Math.PI) / 180); // ≈0.866

// Map door side to a unit-vector normal
const NORMALS = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function segmentIntersectsRect(p1, p2, rect, margin = 1) {
  const rx = rect.x + margin;
  const ry = rect.y + margin;
  const rw = rect.width - margin * 2;
  const rh = rect.height - margin * 2;
  const minX = rx,
    maxX = rx + rw;
  const minY = ry,
    maxY = ry + rh;

  // trivial reject
  if (
    (p1.x < minX && p2.x < minX) ||
    (p1.x > maxX && p2.x > maxX) ||
    (p1.y < minY && p2.y < minY) ||
    (p1.y > maxY && p2.y > maxY)
  ) {
    return false;
  }

  // helper to test two segments for intersection
  function segIntersect(a, b, c, d) {
    const orient = (p, q, r) =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const o1 = orient(a, b, c),
      o2 = orient(a, b, d);
    const o3 = orient(c, d, a),
      o4 = orient(c, d, b);

    // collinearity + on-segment checks
    if (
      o1 === 0 &&
      Math.min(a.x, b.x) <= c.x &&
      c.x <= Math.max(a.x, b.x) &&
      Math.min(a.y, b.y) <= c.y &&
      c.y <= Math.max(a.y, b.y)
    )
      return true;
    if (
      o2 === 0 &&
      Math.min(a.x, b.x) <= d.x &&
      d.x <= Math.max(a.x, b.x) &&
      Math.min(a.y, b.y) <= d.y &&
      d.y <= Math.max(a.y, b.y)
    )
      return true;
    if (
      o3 === 0 &&
      Math.min(c.x, d.x) <= a.x &&
      a.x <= Math.max(c.x, d.x) &&
      Math.min(c.y, d.y) <= a.y &&
      a.y <= Math.max(c.y, d.y)
    )
      return true;
    if (
      o4 === 0 &&
      Math.min(c.x, d.x) <= b.x &&
      b.x <= Math.max(c.x, d.x) &&
      Math.min(c.y, d.y) <= b.y &&
      b.y <= Math.max(c.y, d.y)
    )
      return true;

    return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
  }

  // check each of the four edges
  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
  for (let i = 0; i < 4; i++) {
    if (segIntersect(p1, p2, corners[i], corners[(i + 1) % 4])) {
      return true;
    }
  }
  return false;
}

// Returns true if A and B can talk
function canTalk(lockA, lockB, units) {
  const dx = lockB.x - lockA.x,
    dy = lockB.y - lockA.y;
  const dist = Math.hypot(dx, dy);

  let crosses = 0;
  for (const u of units) {
    const insideB =
      lockB.x >= u.x &&
      lockB.x <= u.x + u.width &&
      lockB.y >= u.y &&
      lockB.y <= u.y + u.height;
    if (insideB) continue;

    if (
      segmentIntersectsRect(
        { x: lockA.x, y: lockA.y },
        { x: lockB.x, y: lockB.y },
        { x: u.x, y: u.y, width: u.width, height: u.height }
      )
    ) {
      crosses++;
    }
  }
  const penalty = crosses * CROSS_PENALTY;
  function adjRange(from, to) {
    const n = NORMALS[from.side];
    const vx = to.x - from.x,
      vy = to.y - from.y;
    const dot = vx * n.x + vy * n.y;
    const inFront = dot > 0 && dot / Math.hypot(vx, vy) >= COS30;
    const base = inFront ? BASE_IN_CONE : BASE_OUT_CONE;
    return base - penalty;
  }

  return (
    dist <= adjRange(lockA, lockB, units) &&
    dist <= adjRange(lockB, lockA, units)
  );
}
const gridSize = 25;
const snap = (v) => Math.round(v / gridSize) * gridSize;

export default function FacilityMap({
  layout,
  setUnitModalUnit,
  onUpdate,
  setIsUnitModalOpen,
  setLayout,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [proximityPairs, setProximityPairs] = useState([]);
  const [proximityText, setProximityText] = useState(true);
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });
  const trRef = useRef();
  const stageRef = useRef();
  const [clipboard, setClipboard] = useState(null);
  const [limitNearest, setLimitNearest] = useState(true);

  useEffect(() => {
    const onKeyDown = (e) => {
      // Copy
      if (e.ctrlKey && e.key === "c" && selectedId) {
        const unit = layout.units.find((u) => u.id === selectedId);
        if (unit) {
          setClipboard(unit);
          console.log("Copied unit", unit.id);
        }
      }
      // Paste
      if (e.ctrlKey && e.key === "v" && clipboard) {
        const newUnit = {
          ...clipboard,
          id: uuid(),
          x: clipboard.x + 20,
          y: clipboard.y + 20,
        };
        setLayout((prev) => ({
          ...prev,
          units: [...prev.units, newUnit],
        }));
        setSelectedId(newUnit.id);
        console.log("Pasted unit", newUnit.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clipboard, selectedId, layout.units]);
  // re‑attach transformer whenever selection or layout changes
  useEffect(() => {
    if (trRef.current && selectedId) {
      const stage = trRef.current.getStage();
      const node = stage.findOne(`#${selectedId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedId, layout]);

  // compute all locked‐door global positions, then find all pairs ≤500px
  function findNearbyLocks() {
    // collect locks with true global positions
    const locks = [];
    layout.units.forEach((unit) => {
      (unit.doors || []).forEach((door) => {
        if (!door.locked) return;

        const barLen = unit.width * 0.8,
          barTh = 4;
        let dx, dy, w, h;
        switch (door.side) {
          case "top":
            w = barLen;
            h = barTh;
            dx = (unit.width - w) / 2;
            dy = -h / 2;
            break;
          case "bottom":
            w = barLen;
            h = barTh;
            dx = (unit.width - w) / 2;
            dy = unit.height - h / 2;
            break;
          case "left":
            w = barTh;
            h = unit.height * 0.8;
            dx = -w / 2;
            dy = (unit.height - h) / 2;
            break;
          case "right":
            w = barTh;
            h = unit.height * 0.8;
            dx = unit.width - w / 2;
            dy = (unit.height - h) / 2;
            break;
        }
        const relX =
          door.side === "bottom"
            ? dx + w * 0.8
            : door.side === "top"
            ? dx + w * 0.2
            : dx + 2;
        const relY =
          door.side === "left"
            ? dy + h * 0.8
            : door.side === "right"
            ? dy + h * 0.2
            : dy + 2;

        locks.push({
          x: unit.x + relX,
          y: unit.y + relY,
          side: door.side,
        });
      });
    });

    const pairsMap = {};
    if (limitNearest) {
      locks.forEach((src, i) => {
        const neigh = locks
          .map((dst, j) => {
            if (i === j) return null;
            const dx = dst.x - src.x,
              dy = dst.y - src.y;
            const d = Math.hypot(dx, dy);
            return canTalk(src, dst, layout.units) ? { j, d } : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.d - b.d)
          .slice(0, 3);

        neigh.forEach(({ j, d }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (!pairsMap[key])
            pairsMap[key] = {
              p1: locks[i],
              p2: locks[j],
              dist: d,
            };
        });
      });
    } else {
      // everyone‐who‐can talk logic
      locks.forEach((A, i) => {
        locks.forEach((B, j) => {
          if (j > i && canTalk(A, B, layout.units)) {
            const d = Math.hypot(B.x - A.x, B.y - A.y);
            const key = `${i}-${j}`;
            pairsMap[key] = { p1: A, p2: B, dist: d };
          }
        });
      });
    }

    setProximityPairs(Object.values(pairsMap));
  }

  return (
    <div className="relative w-full h-full">
      <button
        className="absolute top-2 right-2 z-20 bg-green-600 text-white px-3 py-1 rounded"
        onClick={findNearbyLocks}
      >
        Find Nearby Locks
      </button>
      <button
        className="absolute top-11 right-2 z-20 bg-green-600 text-white px-3 py-1 rounded"
        onClick={() => setProximityText(!proximityText)}
      >
        Turn Distance Calculation {proximityText ? "Off" : "On"}
      </button>
      <button
        className="absolute top-20 right-2 z-20 bg-green-600 text-white px-3 py-1 rounded"
        onClick={() => setProximityPairs([])}
      >
        Clear Distance Lines
      </button>
      <button
        className="absolute top-29 right-2 z-20 bg-green-600 text-white px-3 py-1 rounded"
        onClick={() => setLimitNearest(!limitNearest) & setProximityPairs([])}
      >
        Limit to 3 nearest: {limitNearest ? "On" : "Off"}
      </button>
      <Stage
        width={layout.canvasSize.width}
        height={layout.canvasSize.height}
        ref={stageRef}
        className="border bg-white"
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) setSelectedId(null);
        }}
      >
        {/* Grid */}
        <Layer>
          {Array.from(
            { length: Math.floor(layout.canvasSize.width / gridSize) + 1 },
            (_, i) => (
              <Rect
                key={`v${i}`}
                x={i * gridSize}
                y={0}
                width={1}
                height={layout.canvasSize.height}
                fill="#eee"
              />
            )
          )}
          {Array.from(
            { length: Math.floor(layout.canvasSize.height / gridSize) + 1 },
            (_, j) => (
              <Rect
                key={`h${j}`}
                x={0}
                y={j * gridSize}
                width={layout.canvasSize.width}
                height={1}
                fill="#eee"
              />
            )
          )}
        </Layer>
        {/* Units */}
        <Layer>
          {layout.units.map((unit) => (
            <Group
              key={unit.id}
              id={unit.id}
              x={unit.x}
              y={unit.y}
              draggable
              onClick={() => setSelectedId(unit.id)}
              onDblClick={() => {
                setUnitModalUnit(unit);
                setIsUnitModalOpen(true);
              }}
              dragBoundFunc={(pos) => ({
                x: snap(pos.x),
                y: snap(pos.y),
              })}
              onDragEnd={(e) =>
                onUpdate("moveUnit", unit.id, {
                  x: snap(e.target.x()),
                  y: snap(e.target.y()),
                })
              }
              onMouseEnter={() => {
                setTooltip({
                  visible: true,
                  x: unit.x + unit.width / 2,
                  y: unit.y,
                  text: `${unit.label} — ${unit.width / 5}×${unit.height / 5}`,
                });
                if (stageRef.current) {
                  stageRef.current.container().style.cursor = "pointer";
                }
              }}
              onMouseLeave={() => {
                setTooltip((t) => ({ t, visible: false }));
                if (stageRef.current) {
                  stageRef.current.container().style.cursor = "default";
                }
              }}
            >
              {/* Unit box */}
              <Rect
                width={unit.width}
                height={unit.height}
                fill={unit.color}
                stroke="#333"
                strokeWidth={1}
              />
              <Text
                text={unit.label}
                fontSize={14}
                width={unit.width}
                height={unit.height}
                align="center"
                verticalAlign="middle"
                listening={false}
              />

              {/* Doors & lock circles */}
              {(unit.doors || []).map((door, i) => {
                const barLen = unit.width * 0.8;
                const barTh = 4;
                let x, y, w, h;
                switch (door.side) {
                  case "top":
                    w = barLen;
                    h = barTh;
                    x = (unit.width - w) / 2;
                    y = -h / 2;
                    break;
                  case "bottom":
                    w = barLen;
                    h = barTh;
                    x = (unit.width - w) / 2;
                    y = unit.height - h / 2;
                    break;
                  case "left":
                    w = barTh;
                    h = unit.height * 0.8;
                    x = -w / 2;
                    y = (unit.height - h) / 2;
                    break;
                  case "right":
                    w = barTh;
                    h = unit.height * 0.8;
                    x = unit.width - w / 2;
                    y = (unit.height - h) / 2;
                    break;
                }

                return (
                  <React.Fragment key={i}>
                    <Rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill="#555"
                      cornerRadius={2}
                    />
                    {door.locked && (
                      <Circle
                        x={
                          door.side === "bottom"
                            ? x + w * 0.8
                            : door.side === "top"
                            ? x + w * 0.2
                            : x + 2
                        }
                        y={
                          door.side === "left"
                            ? y + h * 0.8
                            : door.side === "right"
                            ? y + h * 0.2
                            : y + 2
                        }
                        radius={6}
                        fill="blue"
                        listening={true}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </Group>
          ))}

          {/* Transformer for resizing */}
          {selectedId && (
            <Transformer
              ref={trRef}
              rotateEnabled={false}
              enabledAnchors={[
                "top-left",
                "top-center",
                "top-right",
                "middle-left",
                "middle-right",
                "bottom-left",
                "bottom-center",
                "bottom-right",
              ]}
              onTransformEnd={() => {
                const node = trRef.current.nodes()[0];
                const scaleX = node.scaleX(),
                  scaleY = node.scaleY();
                const newW = Math.max(
                  gridSize,
                  Math.round((node.width() * scaleX) / gridSize) * gridSize
                );
                const newH = Math.max(
                  gridSize,
                  Math.round((node.height() * scaleY) / gridSize) * gridSize
                );
                node.width(newW);
                node.height(newH);
                node.scaleX(1);
                node.scaleY(1);
                const newX = snap(node.x()),
                  newY = snap(node.y());
                node.x(newX);
                node.y(newY);
                onUpdate("resizeUnit", selectedId, {
                  x: newX,
                  y: newY,
                  width: newW,
                  height: newH,
                });
                trRef.current.getLayer().batchDraw();
              }}
            />
          )}
        </Layer>
        {/* Proximity overlay */}
        {proximityPairs.length > 0 && (
          <Layer>
            {proximityPairs.map((pair, idx) => (
              <React.Fragment key={idx}>
                <Line
                  points={[pair.p1.x, pair.p1.y, pair.p2.x, pair.p2.y]}
                  stroke="red"
                  strokeWidth={2}
                  dash={[4, 4]}
                />
                {proximityText && (
                  <Text
                    text={`${Math.round(pair.dist) / 5} ft`}
                    fontSize={14}
                    fill="black"
                    x={(pair.p1.x + pair.p2.x) / 2 + 5}
                    y={(pair.p1.y + pair.p2.y) / 2 - 10}
                    listening={false}
                  />
                )}
              </React.Fragment>
            ))}
          </Layer>
        )}
        {tooltip.visible && (
          <Layer>
            <Label x={tooltip.x} y={tooltip.y} listening={false}>
              <Tag
                fill="black"
                pointerDirection="down"
                pointerWidth={10}
                pointerHeight={8}
                cornerRadius={3}
              />
              <Text
                text={tooltip.text}
                fontSize={12}
                padding={6}
                fill="white"
              />
            </Label>
          </Layer>
        )}
      </Stage>
    </div>
  );
}
