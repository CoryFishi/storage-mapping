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
import EditAccessPointModal from "./EditAccessPointModal";

const PX_PER_FT = 5;

export default function FacilityMap({
  layout,
  setUnitModalUnit,
  onUpdate,
  setIsUnitModalOpen,
  setLayout,
  params,
  proximityPairs,
  proximityText,
  getTriangleCorners,
  hasTriangleSide,
  getTriangleLockPos,
  getAllLocks,
  rootLockIndex,
  reachability,
  pointInRect,
  pointInTriangle,
  countCrossedUnits,
  clamp01,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });
  const trRef = useRef();
  const stageRef = useRef();
  const [clipboard, setClipboard] = useState(null);
  const [isEditAccessPointModalOpen, setIsEditAccessPointModalOpen] =
    useState(false);
  const [editAccessPoint, setEditAccessPoint] = useState(null);

  const gridSize = 25;

  const snap = (v) => Math.round(v / gridSize) * gridSize;

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
      if (e.key === "Delete" && selectedId) {
        setLayout((prev) => ({
          ...prev,
          units: prev.units.filter((u) => u.id !== selectedId),
        }));
        setSelectedId(null);
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
  return (
    <div className="relative w-full h-full">
      {isEditAccessPointModalOpen && (
        <EditAccessPointModal
          accesspoint={editAccessPoint}
          setIsEditAccessPointModalOpen={setIsEditAccessPointModalOpen}
          onSave={(updated) => {
            setLayout((prev) => ({
              ...prev,
              accessPoints: prev.accessPoints.map((u) =>
                u.id === updated.id ? updated : u
              ),
            }));
          }}
        />
      )}
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
              {unit.shape === "rightTriangle" ? (
                <>
                  {/* triangle body */}
                  <Line
                    points={getTriangleCorners(unit).flatMap((p) => [p.x, p.y])}
                    closed
                    fill={unit.color}
                    stroke="#333"
                    strokeWidth={1}
                  />
                </>
              ) : (
                <>
                  {/* rectangle body */}
                  <Rect
                    width={unit.width}
                    height={unit.height}
                    fill={unit.color}
                    stroke="#333"
                    strokeWidth={1}
                  />
                </>
              )}

              {/* label (works for both) */}
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
                const barTh = 4;
                let doorBar = null;
                let lockPos = null;

                if (unit.shape === "rightTriangle") {
                  // triangle-specific logic
                  const orient = unit.orientation || "nw";
                  if (!hasTriangleSide(orient, door.side)) {
                    return null; // invalid side for this triangle
                  }

                  // compute bar for leg sides (top/bottom/left/right)
                  if (door.side === "top") {
                    const barLen = unit.width * 0.8;
                    const x = (unit.width - barLen) / 2;
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
                    const barLen = unit.width * 0.8;
                    const x = (unit.width - barLen) / 2;
                    const y = unit.height - barTh / 2;
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
                    const barLen = unit.height * 0.8;
                    const x = -barTh / 2;
                    const y = (unit.height - barLen) / 2;
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
                    const barLen = unit.height * 0.8;
                    const x = unit.width - barTh / 2;
                    const y = (unit.height - barLen) / 2;
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
                    // corners: [rightAngleCorner, other1, other2]
                    const corners = getTriangleCorners(unit);
                    const p1 = corners[1];
                    const p2 = corners[2];

                    // bar center/orientation
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    const deltaX = p2.x - p1.x;
                    const deltaY = p2.y - p1.y;
                    const fullLen = Math.hypot(deltaX, deltaY);
                    const length = fullLen * 0.8; // your original scaling
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
                  lockPos = getTriangleLockPos(unit, door);
                } else {
                  // rectangle fallback (existing logic)
                  const barLen = unit.width * 0.8;
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
                  <React.Fragment key={i}>
                    {doorBar}
                    {door.locked && lockPos && (
                      <Circle
                        x={lockPos.x}
                        y={lockPos.y}
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
                const node = trRef.current?.nodes()[0];
                if (!node || !selectedId) return;

                // find the source unit so we can fallback if group width/height is zero
                const unit = layout.units.find((u) => u.id === selectedId);
                if (!unit) return;

                const scaleX = node.scaleX();
                const scaleY = node.scaleY();

                // if effectively no resize, just snap position
                const eps = 0.01;
                if (Math.abs(scaleX - 1) < eps && Math.abs(scaleY - 1) < eps) {
                  const newX = snap(node.x());
                  const newY = snap(node.y());
                  node.x(newX);
                  node.y(newY);
                  return;
                }

                // base dimensions: prefer what's on the node, else fallback to the unit data
                const baseWidth = node.width() || unit.width;
                const baseHeight = node.height() || unit.height;

                const rawWidth = baseWidth * scaleX;
                const rawHeight = baseHeight * scaleY;

                const newW = Math.max(
                  gridSize,
                  Math.round(rawWidth / gridSize) * gridSize
                );
                const newH = Math.max(
                  gridSize,
                  Math.round(rawHeight / gridSize) * gridSize
                );

                // apply normalized size and clear scale
                node.scaleX(1);
                node.scaleY(1);
                node.width(newW);
                node.height(newH);

                // snap position
                const newX = snap(node.x());
                const newY = snap(node.y());
                node.x(newX);
                node.y(newY);

                onUpdate("resizeUnit", selectedId, {
                  x: newX,
                  y: newY,
                  width: newW,
                  height: newH,
                });

                trRef.current.getLayer()?.batchDraw();
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
                  stroke={pair.color || "red"}
                  strokeWidth={2}
                  dash={[4, 4]}
                />
                {proximityText && (
                  <Text
                    text={`${Math.round(pair.dist / PX_PER_FT)} ft \n ${
                      pair.quality.toFixed(2) * 100
                    }%`}
                    fontSize={14}
                    fill={"black"}
                    x={(pair.p1.x + pair.p2.x) / 2 + 5}
                    y={(pair.p1.y + pair.p2.y) / 2 - 10}
                    listening={false}
                  />
                )}
              </React.Fragment>
            ))}
          </Layer>
        )}
        {/* Reachability visualization */}
        {rootLockIndex != null && (
          <Layer>
            {(() => {
              const locks = getAllLocks();
              const { visited, predecessor } = reachability;

              // draw tree edges (green) from predecessor
              const treeLines = Object.entries(predecessor).map(
                ([childStr, parent]) => {
                  const child = parseInt(childStr, 10);
                  const p1 = locks[parent];
                  const p2 = locks[child];
                  if (!p1 || !p2) return null;
                  return (
                    <Line
                      key={`tree-${parent}-${child}`}
                      points={[p1.x, p1.y, p2.x, p2.y]}
                      stroke="green"
                      strokeWidth={2}
                    />
                  );
                }
              );

              // highlight unreachable locks with red circle
              const unreachableCircles = locks
                .map((lock, idx) => ({ lock, idx }))
                .filter(({ idx }) => !visited.has(idx))
                .map(({ lock, idx }) => (
                  <Circle
                    key={`unreach-${idx}`}
                    x={lock.x}
                    y={lock.y}
                    radius={10}
                    stroke="red"
                    strokeWidth={2}
                  />
                ));

              // mark root lock
              const rootMark = (() => {
                const root = locks[rootLockIndex];
                if (!root) return null;
                return (
                  <Circle
                    key="root-lock"
                    x={root.x}
                    y={root.y}
                    radius={10}
                    stroke="blue"
                    strokeWidth={3}
                  />
                );
              })();

              return (
                <>
                  {treeLines}
                  {unreachableCircles}
                  {rootMark}
                </>
              );
            })()}
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
        <Layer>
          {(layout.accessPoints || []).map((ap) => (
            <React.Fragment key={ap.id}>
              {/* Range disc */}
              {ap.showRange && (
                <>
                  <Text
                    text={`${Math.round(ap.range / PX_PER_FT)} ft`}
                    fontSize={12}
                    x={ap.x + ap.range + 2}
                    y={ap.y}
                    listening={false}
                  />
                  <Circle
                    x={ap.x}
                    y={ap.y}
                    radius={ap.range}
                    stroke="rgba(200, 0, 0, 0.7)"
                    strokeWidth={2}
                    fill="rgba(200, 0, 0, 0.15)"
                    listening={false}
                  />
                  <Text
                    text={`${Math.round(ap.range / 1.5 / PX_PER_FT)} ft`}
                    fontSize={12}
                    x={ap.x + ap.range / 1.5 + 2}
                    y={ap.y}
                    listening={false}
                  />
                  <Circle
                    x={ap.x}
                    y={ap.y}
                    radius={ap.range / 1.5}
                    stroke="rgba(200, 200, 0, 0.7)"
                    strokeWidth={2}
                    fill="rgba(200, 200, 0, 0.15)"
                    listening={false}
                  />
                  <Text
                    text={`${Math.round(ap.range / 2.5 / PX_PER_FT)} ft`}
                    fontSize={12}
                    x={ap.x + ap.range / 2.5 + 2}
                    y={ap.y}
                    listening={false}
                  />
                  <Circle
                    x={ap.x}
                    y={ap.y}
                    radius={ap.range / 2.5}
                    stroke="rgba(34, 197, 94, 0.7)"
                    strokeWidth={2}
                    fill="rgba(34, 197, 94, 0.15)"
                    listening={false}
                  />
                </>
              )}
              {/* Access point marker */}
              <Circle
                x={ap.x}
                y={ap.y}
                radius={8}
                fill={ap.color}
                stroke="#000"
                strokeWidth={1}
                draggable
                onDragEnd={(e) => {
                  const newX = snap(e.target.x());
                  const newY = snap(e.target.y());
                  setLayout((prev) => ({
                    ...prev,
                    accessPoints: (prev.accessPoints || []).map((p) =>
                      p.id === ap.id ? { ...p, x: newX, y: newY } : p
                    ),
                  }));
                }}
                onDblClick={(e) => {
                  e.cancelBubble = true;
                  setIsEditAccessPointModalOpen(true);
                  setEditAccessPoint(ap);
                  console.log(ap);
                }}
                onClick={(e) => {
                  setLayout((prev) => ({
                    ...prev,
                    accessPoints: (prev.accessPoints || []).map((p) =>
                      p.id === ap.id ? { ...p, showRange: !ap.showRange } : p
                    ),
                  }));
                }}
              />
              <Text
                text={ap.label}
                fontSize={12}
                x={ap.x + 10}
                y={ap.y - 12}
                listening={false}
              />
            </React.Fragment>
          ))}
          {(layout.accessPoints || []).map((ap) => {
            const allLocks = getAllLocks();

            const links = allLocks
              .map((lock) => {
                const dist = Math.hypot(lock.x - ap.x, lock.y - ap.y); // pixel distance
                if (dist > ap.range) return null;

                // endpoint: lock is inside some unit(s); AP is not a unit so only exclude the lock's containing unit(s)
                const endpointIds = new Set();
                for (const u of layout.units) {
                  const containsLock =
                    u.shape === "rightTriangle"
                      ? pointInTriangle(lock.x, lock.y, u)
                      : pointInRect(lock.x, lock.y, u);
                  if (containsLock) endpointIds.add(u.id);
                }

                // count crossed units between lock and AP
                const crosses = countCrossedUnits(
                  lock,
                  { x: ap.x, y: ap.y, side: null, orientation: undefined },
                  layout.units,
                  endpointIds
                );

                const baseRangePx = ap.range;
                const crossPenaltyPx = params.crossPenalty * PX_PER_FT;

                const distScore = 1 - clamp01(dist / baseRangePx);
                const obsScore =
                  1 - clamp01((crosses * crossPenaltyPx) / baseRangePx);
                const quality = Math.min(distScore, obsScore); // conservative

                let color;
                if (quality > 0.75) color = "green";
                else if (quality > 0.4) color = "orange";
                else color = "red";

                return { lock, dist, quality, color, crosses };
              })
              .filter(Boolean);

            return (
              <React.Fragment key={ap.id}>
                {links
                  .sort((a, b) => {
                    if (b.quality !== a.quality) return b.quality - a.quality;
                    return a.dist - b.dist;
                  })
                  .slice(0, 14)
                  .map(({ lock, dist, quality, color }, idx) => (
                    <React.Fragment key={`ap-link-${ap.id}-${idx}`}>
                      <Line
                        points={[ap.x, ap.y, lock.x, lock.y]}
                        stroke={color}
                        strokeWidth={Math.max(1, quality * 3)}
                        dash={[2, 4]}
                      />
                      {proximityText && (
                        <Text
                          text={`${Math.round(
                            dist / PX_PER_FT
                          )} ft \n${Math.round(quality * 100)}%`}
                          fontSize={12}
                          fill="black"
                          x={(ap.x + lock.x) / 2 + 5}
                          y={(ap.y + lock.y) / 2 - 10}
                          listening={false}
                        />
                      )}
                    </React.Fragment>
                  ))}
              </React.Fragment>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
