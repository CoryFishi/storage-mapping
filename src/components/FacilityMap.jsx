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

const PX_PER_FT = 5;

export default function FacilityMap({
  layout,
  setUnitModalUnit,
  onUpdate,
  setIsUnitModalOpen,
  setLayout,
  params,
  cosHalfAngle,
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
  const [reachability, setReachability] = useState({
    visited: new Set(),
    predecessor: {},
  });
  const [rootLockIndex, setRootLockIndex] = useState(null);
  // Map door side to a unit-vector normal
  const NORMALS = {
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  // Outward normals for triangle hypotenuse by orientation
  const HYPOTENUSE_NORMALS = {
    nw: { x: 1 / Math.SQRT2, y: 1 / Math.SQRT2 },
    ne: { x: -1 / Math.SQRT2, y: 1 / Math.SQRT2 },
    se: { x: -1 / Math.SQRT2, y: -1 / Math.SQRT2 },
    sw: { x: 1 / Math.SQRT2, y: -1 / Math.SQRT2 },
  };
  function getAllLocks() {
    const locks = [];
    layout.units.forEach((unit) => {
      (unit.doors || []).forEach((door) => {
        if (!door.locked) return;

        let lockPos;
        if (unit.shape === "rightTriangle") {
          lockPos = getTriangleLockPos(unit, door);
        } else {
          const barLen = unit.width * 0.8;
          const barTh = 4;
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

          lockPos = {
            x:
              door.side === "bottom"
                ? dx + w * 0.8
                : door.side === "top"
                ? dx + w * 0.2
                : dx + 2,
            y:
              door.side === "left"
                ? dy + h * 0.8
                : door.side === "right"
                ? dy + h * 0.2
                : dy + 2,
          };
        }

        if (!lockPos) return;

        locks.push({
          x: unit.x + lockPos.x,
          y: unit.y + lockPos.y,
          side: door.side,
          orientation:
            unit.shape === "rightTriangle"
              ? unit.orientation || "nw"
              : undefined,
          unitId: unit.id,
        });
      });
    });
    return locks;
  }
  function buildAdjacency(locks) {
    const adj = locks.map(() => []);
    for (let i = 0; i < locks.length; i++) {
      for (let j = 0; j < locks.length; j++) {
        if (i === j) continue;
        if (canTalk(locks[i], locks[j], layout.units, params, cosHalfAngle)) {
          adj[i].push(j);
        }
      }
    }
    return adj;
  }

  function traverseFromRoot(rootIndex, adjacency) {
    const visited = new Set([rootIndex]);
    const predecessor = {};
    const queue = [rootIndex];
    while (queue.length) {
      const u = queue.shift();
      for (const v of adjacency[u]) {
        if (!visited.has(v)) {
          visited.add(v);
          predecessor[v] = u;
          queue.push(v);
        }
      }
    }
    return { visited, predecessor };
  }

  // reconstruct path (array of indices) from target back to root
  function getPathToRoot(targetIndex, rootIndex, predecessor) {
    if (targetIndex === rootIndex) return [rootIndex];
    if (!(targetIndex in predecessor)) return null;
    const path = [];
    let cur = targetIndex;
    while (cur !== undefined) {
      path.push(cur);
      if (cur === rootIndex) break;
      cur = predecessor[cur];
    }
    return path.reverse();
  }
  function computeReachability(rootIndex) {
    const locks = getAllLocks();
    if (rootIndex == null || rootIndex < 0 || rootIndex >= locks.length) return;
    const adjacency = buildAdjacency(locks);
    const { visited, predecessor } = traverseFromRoot(rootIndex, adjacency);
    setReachability({ visited, predecessor });
    setRootLockIndex(rootIndex);
    // Optionally store the locks array if you want to reference it elsewhere
    return locks;
  }

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
  function segmentIntersectsTriangle(p1, p2, unit) {
    const corners = getTriangleCorners(unit).map((c) => ({
      x: unit.x + c.x,
      y: unit.y + c.y,
    }));

    function segIntersect(a, b, c, d) {
      const orient = (p, q, r) =>
        (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
      const o1 = orient(a, b, c),
        o2 = orient(a, b, d);
      const o3 = orient(c, d, a),
        o4 = orient(c, d, b);

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

    for (let i = 0; i < 3; i++) {
      if (segIntersect(p1, p2, corners[i], corners[(i + 1) % 3])) {
        return true;
      }
    }
    return false;
  }
  const getTriangleCorners = (unit) => {
    // local coords, right angle at:
    // "nw": (0,0), legs to right and down
    // "ne": (unit.width,0), legs to left and down
    // "se": (unit.width, unit.height), legs to left and up
    // "sw": (0, unit.height), legs to right and up
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
        // fallback to full square triangle
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
  function getTriangleLockPos(unit, door) {
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
  }
  function pointInRect(px, py, u) {
    return (
      px >= u.x && px <= u.x + u.width && py >= u.y && py <= u.y + u.height
    );
  }
  function pointInTriangle(px, py, u) {
    const tri = getTriangleCorners(u).map((c) => ({
      x: u.x + c.x,
      y: u.y + c.y,
    }));
    const [a, b, c] = tri;
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const s = ((c.y - a.y) * (px - a.x) + (a.x - c.x) * (py - a.y)) / area;
    const t = ((a.y - b.y) * (px - a.x) + (b.x - a.x) * (py - a.y)) / area;
    return s >= 0 && t >= 0 && s + t <= 1;
  }
  function canTalk(lockA, lockB, units, params, cosHalfAngle) {
    const dx = lockB.x - lockA.x;
    const dy = lockB.y - lockA.y;
    const distPx = Math.hypot(dx, dy);

    const baseInConePx = params.baseInCone * PX_PER_FT;
    const baseOutConePx = params.baseOutCone * PX_PER_FT;
    const crossPenaltyPx = params.crossPenalty * PX_PER_FT;

    // determine endpoint-containing units so we don't count them
    const endpointIds = new Set();
    for (const u of units) {
      const containsA =
        u.shape === "rightTriangle"
          ? pointInTriangle(lockA.x, lockA.y, u)
          : pointInRect(lockA.x, lockA.y, u);
      const containsB =
        u.shape === "rightTriangle"
          ? pointInTriangle(lockB.x, lockB.y, u)
          : pointInRect(lockB.x, lockB.y, u);
      if (containsA || containsB) endpointIds.add(u.id);
    }

    // count crossed units via segmentIntersectsRect (excluding endpoints)
    const crosses = countCrossedUnits(lockA, lockB, units, endpointIds);

    const penaltyPx = crosses * crossPenaltyPx;

    // adjusted range from one lock toward the other
    function adjRangePx(from, to) {
      const n =
        from.side === "hypotenuse"
          ? HYPOTENUSE_NORMALS[from.orientation || "nw"]
          : NORMALS[from.side];
      if (!n) return 0;
      const vx = to.x - from.x;
      const vy = to.y - from.y;
      const dot = vx * n.x + vy * n.y;
      const dist = Math.hypot(vx, vy);
      const inFront = dot > 0 && dist > 0 && dot / dist >= cosHalfAngle;
      const base = inFront ? baseInConePx : baseOutConePx;
      return Math.max(0, base - penaltyPx);
    }

    return (
      distPx <= adjRangePx(lockA, lockB) && distPx <= adjRangePx(lockB, lockA)
    );
  }
  function countCrossedUnits(lockA, lockB, units, endpointIds) {
    const crossed = new Set();
    const p1 = { x: lockA.x, y: lockA.y };
    const p2 = { x: lockB.x, y: lockB.y };

    for (const u of units) {
      if (endpointIds.has(u.id)) continue;

      let intersects = false;
      if (u.shape === "rightTriangle") {
        intersects = segmentIntersectsTriangle(p1, p2, u);
      } else {
        intersects = segmentIntersectsRect(p1, p2, {
          x: u.x,
          y: u.y,
          width: u.width,
          height: u.height,
        });
      }

      if (intersects) {
        crossed.add(u.id);
      }
    }

    return crossed.size;
  }
  function getEndpointIds(lockA, lockB, units) {
    const endpointIds = new Set();
    for (const u of units) {
      const containsA =
        u.shape === "rightTriangle"
          ? pointInTriangle(lockA.x, lockA.y, u)
          : pointInRect(lockA.x, lockA.y, u);
      const containsB =
        u.shape === "rightTriangle"
          ? pointInTriangle(lockB.x, lockB.y, u)
          : pointInRect(lockB.x, lockB.y, u);
      if (containsA || containsB) endpointIds.add(u.id);
    }
    return endpointIds;
  }

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function findNearbyLocks() {
    const locks = [];
    layout.units.forEach((unit) => {
      (unit.doors || []).forEach((door) => {
        if (!door.locked) return;

        let lockPos;
        if (unit.shape === "rightTriangle") {
          lockPos = getTriangleLockPos(unit, door);
        } else {
          const barLen = unit.width * 0.8;
          const barTh = 4;
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

          lockPos = {
            x:
              door.side === "bottom"
                ? dx + w * 0.8
                : door.side === "top"
                ? dx + w * 0.2
                : dx + 2,
            y:
              door.side === "left"
                ? dy + h * 0.8
                : door.side === "right"
                ? dy + h * 0.2
                : dy + 2,
          };
        }

        if (!lockPos) return;

        locks.push({
          x: unit.x + lockPos.x,
          y: unit.y + lockPos.y,
          side: door.side,
          orientation:
            unit.shape === "rightTriangle"
              ? unit.orientation || "nw"
              : undefined,
        });
      });
    });

    const pairsMap = {};
    if (limitNearest) {
      locks.forEach((src, i) => {
        const neighbors = locks
          .map((dst, j) => {
            if (i === j) return null;
            const d = Math.hypot(dst.x - src.x, dst.y - src.y);
            if (!canTalk(src, dst, layout.units, params, cosHalfAngle))
              return null;

            // compute crossings with proper endpoint exclusion
            const endpointIds = getEndpointIds(src, dst, layout.units);
            const crosses = countCrossedUnits(
              src,
              dst,
              layout.units,
              endpointIds
            );

            const baseInConePx = params.baseInCone * PX_PER_FT;
            const crossPenaltyPx = params.crossPenalty * PX_PER_FT;

            // distance score: closer is better
            const distScore = 1 - clamp01(d / baseInConePx);
            // obstruction score: fewer crossings is better
            const obsScore =
              1 - clamp01((crosses * crossPenaltyPx) / baseInConePx);
            const quality = Math.min(distScore, obsScore); // conservative

            let color;
            if (quality > 0.75) color = "green";
            else if (quality > 0.4) color = "orange";
            else color = "red";

            return { j, dist: d, crosses, quality, color };
          })
          .filter(Boolean)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 3);

        neighbors.forEach(({ j, dist, crosses, quality, color }) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (!pairsMap[key]) {
            pairsMap[key] = {
              p1: locks[i],
              p2: locks[j],
              dist,
              crosses,
              quality,
              color,
              i,
              j,
            };
          }
        });
      });
    } else {
      for (let i = 0; i < locks.length; i++) {
        for (let j = i + 1; j < locks.length; j++) {
          if (!canTalk(locks[i], locks[j], layout.units, params, cosHalfAngle))
            continue;
          const d = Math.hypot(
            locks[j].x - locks[i].x,
            locks[j].y - locks[i].y
          );

          const endpointIds = getEndpointIds(locks[i], locks[j], layout.units);
          const crosses = countCrossedUnits(
            locks[i],
            locks[j],
            layout.units,
            endpointIds
          );
          const baseInConePx = params.baseInCone * PX_PER_FT;
          const crossPenaltyPx = params.crossPenalty * PX_PER_FT;
          const distScore = 1 - clamp01(d / baseInConePx);
          const obsScore =
            1 - clamp01((crosses * crossPenaltyPx) / baseInConePx);
          const quality = Math.min(distScore, obsScore);
          let color;
          if (quality > 0.75) color = "green";
          else if (quality > 0.4) color = "orange";
          else color = "red";

          const key = `${i}-${j}`;
          pairsMap[key] = {
            p1: locks[i],
            p2: locks[j],
            dist: d,
            crosses,
            quality,
            color,
            i,
            j,
          };
        }
      }
    }

    setProximityPairs(Object.values(pairsMap));
  }

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
        onClick={() => setProximityPairs([]) & console.log(layout.units)}
      >
        Clear Distance Lines
      </button>
      <button
        className="absolute top-29 right-2 z-20 bg-green-600 text-white px-3 py-1 rounded"
        onClick={() => setLimitNearest(!limitNearest) & setProximityPairs([])}
      >
        Limit to 3 nearest: {limitNearest ? "On" : "Off"}
      </button>
      <button
        className="absolute top-38 right-2 z-20 bg-purple-600 text-white px-3 py-1 rounded"
        onClick={() => {
          const locks = getAllLocks();
          if (locks.length === 0) return;
          // for demo, pick lock 0 as root
          computeReachability(50);
        }}
      >
        Compute Reachability from First Lock
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
      </Stage>
    </div>
  );
}
