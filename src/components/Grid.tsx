import { CellType, Direction, Position } from '@/types/game';
import Image from 'next/image';

interface GridProps {
  grid: CellType[][];
  robotPosition: Position;
  robotDirection: Direction;
}

const directionRotation: Record<Direction, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270
};

export default function Grid({ grid, robotPosition, robotDirection }: GridProps) {
  const getCellContent = (cellType: CellType, x: number, y: number) => {
    const isRobotHere = robotPosition.x === x && robotPosition.y === y;

    if (isRobotHere) {
      return (
        <div className="w-full h-full flex items-center justify-center relative">
          <Image
            src="/robot.png"
            alt="Robot"
            width={24}
            height={24}
            style={{
              transform: `rotate(${directionRotation[robotDirection]}deg)`,
              transition: 'transform 0.3s ease'
            }}
            className="object-contain"
          />
        </div>
      );
    }

    switch (cellType) {
      case '*':
        return (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            💣
          </div>
        );
      case 'o':
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-yellow-400 border-2 border-yellow-600"></div>
          </div>
        );
      default:
        return null;
    }
  };

  const getCellStyle = (cellType: CellType, x: number, y: number) => {
    const isRobotHere = robotPosition.x === x && robotPosition.y === y;
    
    let bgColor = 'bg-gray-100';
    
    if (isRobotHere) {
      bgColor = 'bg-blue-100';
    } else if (cellType === '*') {
      bgColor = 'bg-red-50';
    }

    return `${bgColor} border border-gray-300 transition-all duration-300`;
  };

  return (
    <div className="inline-block bg-white p-4 rounded-lg shadow-lg">
      <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${grid[0]?.length || 25}, minmax(0, 1fr))` }}>
        {grid.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${x}-${y}`}
              className={`w-6 h-6 ${getCellStyle(cell, x, y)}`}
            >
              {getCellContent(cell, x, y)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
