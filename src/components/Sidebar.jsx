import { v4 as uuid } from "uuid";

export default function Sidebar({ layout, setLayout }) {
  const addUnit = (width, height) => {
    const newUnit = {
      id: uuid(),
      label: `Unit ${layout.units.length}`,
      x: 0,
      y: 0,
      width: width,
      height: height,
      color: "#e5e7eb",
      doors: [{ side: "bottom" }],
    };
    setLayout((prev) => ({
      ...prev,
      units: [...prev.units, newUnit],
    }));
  };

  return (
    <div className="w-64 bg-gray-100  border-r p-4 space-y-4">
      <button
        onClick={() => addUnit(25, 25)}
        className="w-full py-2 bg-blue-600 text-white rounded"
      >
        Add Unit
      </button>
    </div>
  );
}
