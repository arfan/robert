export type CellType = '.' | '*' | 'o' | 'u' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type Command = 's' | 'l' | 'r';

export interface Position {
  x: number;
  y: number;
}

export interface RobotState {
  position: Position;
  direction: Direction;
}

export interface GameState {
  grid: CellType[][];
  robot: RobotState;
  initialRobot: RobotState;
  pointsCollected: number;
  totalPoints: number;
  isGameOver: boolean;
  isWon: boolean;
  message: string;
}
