import { useState, useCallback, useMemo } from "react";
import FacilityMap from "./components/FacilityMap";
import Sidebar from "./components/Sidebar";
import { applyChange } from "./utils/applyChange";
import UnitModal from "./components/UnitModal";

const PX_PER_FT = 5;

function App() {
  const [params, setParams] = useState({
    baseInCone: 150,
    baseOutCone: 55,
    crossPenalty: 50,
    halfConeDeg: 30,
  });
  const [unitModalUnit, setUnitModalUnit] = useState({});
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [limitNearest, setLimitNearest] = useState(true);
  const [layout, setLayout] = useState({
    canvasSize: { width: 1200, height: 800 },
    units: [],
  });
  const [proximityPairs, setProximityPairs] = useState([]);
  const [proximityText, setProximityText] = useState(true);
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
  const hasTriangleSide = (orientation, side) => {
    const mapping = {
      nw: ["top", "left", "hypotenuse"],
      ne: ["top", "right", "hypotenuse"],
      se: ["bottom", "right", "hypotenuse"],
      sw: ["bottom", "left", "hypotenuse"],
    };
    return mapping[orientation]?.includes(side);
  };
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
  function canLockTalkToAP(lock, ap, units, params, cosHalfAngle) {
    const dx = ap.x - lock.x;
    const dy = ap.y - lock.y;
    const distPx = Math.hypot(dx, dy);

    const baseInConePx = params.baseInCone * PX_PER_FT;
    const baseOutConePx = params.baseOutCone * PX_PER_FT;
    const crossPenaltyPx = params.crossPenalty * PX_PER_FT;

    // determine endpoint-containing unit for lock to exclude it from crossing count
    const endpointIds = new Set();
    for (const u of units) {
      const containsLock =
        u.shape === "rightTriangle"
          ? pointInTriangle(lock.x, lock.y, u)
          : pointInRect(lock.x, lock.y, u);
      if (containsLock) endpointIds.add(u.id);
    }

    const crosses = countCrossedUnits(
      { x: lock.x, y: lock.y, side: lock.side, orientation: lock.orientation },
      { x: ap.x, y: ap.y },
      units,
      endpointIds
    );
    const penaltyPx = crosses * crossPenaltyPx;

    // cone test for lock (AP is omnidirectional so we don't test its cone)
    const n =
      lock.side === "hypotenuse"
        ? HYPOTENUSE_NORMALS[lock.orientation || "nw"]
        : NORMALS[lock.side];
    if (!n) return false; // safety

    const vx = ap.x - lock.x;
    const vy = ap.y - lock.y;
    const dot = vx * n.x + vy * n.y;
    const dist = distPx;
    const inFront = dot > 0 && dist > 0 && dot / dist >= cosHalfAngle;
    const base = inFront ? baseInConePx : baseOutConePx;
    const allowedRange = Math.max(0, base - penaltyPx);
    return distPx <= allowedRange;
  }
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
        findNearbyLocks={findNearbyLocks}
        limitNearest={limitNearest}
        setLimitNearest={setLimitNearest}
        setProximityPairs={setProximityPairs}
        setProximityText={setProximityText}
        proximityText={proximityText}
        getAllLocks={getAllLocks}
        computeReachability={computeReachability}
      />
      <div
        className={`p-2 h-[${layout.canvasSize.height}] w-[${layout.canvasSize.width}]`}
      >
        <FacilityMap
          layout={layout}
          params={params}
          findNearbyLocks={findNearbyLocks}
          onUpdate={handleUpdate}
          setUnitModalUnit={setUnitModalUnit}
          setIsUnitModalOpen={setIsUnitModalOpen}
          setLayout={setLayout}
          cosHalfAngle={cosHalfAngle}
          proximityPairs={proximityPairs}
          setProximityPairs={setProximityPairs}
          proximityText={proximityText}
          setProximityText={setProximityText}
          canTalk={canTalk}
          getTriangleCorners={getTriangleCorners}
          hasTriangleSide={hasTriangleSide}
          getTriangleLockPos={getTriangleLockPos}
          getAllLocks={getAllLocks}
          computeReachability={computeReachability}
          setReachability={setReachability}
          setRootLockIndex={setRootLockIndex}
          rootLockIndex={rootLockIndex}
          reachability={reachability}
          canLockTalkToAP={canLockTalkToAP}
        />
      </div>
    </div>
  );
}

export default App;
