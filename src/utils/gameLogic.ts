import { CellType, Direction, Command, Position, RobotState, GameState } from '@/types/game';

export function parseLevel(levelData: string): { grid: CellType[][], robotStart: Position } {
  const lines = levelData.trim().split('\n');
  const grid: CellType[][] = [];
  let robotStart: Position = { x: 0, y: 0 };
  const GRID_SIZE = 25;

  // Parse the level data
  lines.forEach((line, y) => {
    const row: CellType[] = [];
    for (let x = 0; x < line.length; x++) {
      const char = line[x] as CellType;
      if (char === 'u') {
        robotStart = { x, y };
        row.push('.'); // Replace 'u' with empty cell in grid
      } else {
        row.push(char);
      }
    }
    grid.push(row);
  });

  // Normalize to 25x25 grid
  // First, pad rows to be 25 columns wide
  for (let y = 0; y < grid.length; y++) {
    while (grid[y].length < GRID_SIZE) {
      grid[y].push('.');
    }
    // Trim if longer than 25
    if (grid[y].length > GRID_SIZE) {
      grid[y] = grid[y].slice(0, GRID_SIZE);
    }
  }

  // Then, add or remove rows to make it 25 rows
  while (grid.length < GRID_SIZE) {
    grid.push(Array(GRID_SIZE).fill('.') as CellType[]);
  }
  if (grid.length > GRID_SIZE) {
    grid.splice(GRID_SIZE);
  }

  return { grid, robotStart };
}

export function countTotalPoints(grid: CellType[][]): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === 'o') count++;
    }
  }
  return count;
}

export function turnLeft(direction: Direction): Direction {
  const directions: Direction[] = ['up', 'right', 'down', 'left'];
  const currentIndex = directions.indexOf(direction);
  return directions[(currentIndex + 3) % 4]; // +3 is same as -1 in mod 4
}

export function turnRight(direction: Direction): Direction {
  const directions: Direction[] = ['up', 'right', 'down', 'left'];
  const currentIndex = directions.indexOf(direction);
  return directions[(currentIndex + 1) % 4];
}

export function getNextPosition(pos: Position, direction: Direction): Position {
  switch (direction) {
    case 'up':
      return { x: pos.x, y: pos.y - 1 };
    case 'down':
      return { x: pos.x, y: pos.y + 1 };
    case 'left':
      return { x: pos.x - 1, y: pos.y };
    case 'right':
      return { x: pos.x + 1, y: pos.y };
  }
}

export function isValidPosition(pos: Position, grid: CellType[][]): boolean {
  return pos.y >= 0 && pos.y < grid.length && pos.x >= 0 && pos.x < grid[0].length;
}

export function parseFunctions(commandString: string): { [key: string]: string } {
  const functions: { [key: string]: string } = {};
  const lines = commandString.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    // Match function definition pattern: "singleLetter:commands"
    const match = trimmedLine.match(/^([a-zA-Z]):(.+)$/);
    if (match) {
      const [, funcName, commands] = match;
      functions[funcName.toLowerCase()] = commands;
    }
  }
  
  return functions;
}

export function expandFunctions(
  commandString: string, 
  functions: { [key: string]: string }, 
  depth: number = 0, 
  maxDepth: number = 1000
): string {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    throw new Error(`Maximum recursion depth (${maxDepth}) exceeded. Check for infinite loops in your functions.`);
  }

  const lines = commandString.split('\n');
  
  // Remove function definitions, keep only the execution lines
  const executionLines = lines.filter(line => !line.trim().match(/^([a-zA-Z]):(.+)$/));
  const expanded = executionLines.join('');
  
  // Expand function calls - each character is either a command or function call
  let result = '';
  
  for (let i = 0; i < expanded.length; i++) {
    const char = expanded[i].toLowerCase();
    
    if (char === 's' || char === 'l' || char === 'r') {
      // Direct command
      result += char;
    } else if (/[a-z]/.test(char) && functions[char]) {
      // Function call - expand it recursively with increased depth
      result += expandFunctions(functions[char], functions, depth + 1, maxDepth);
    }
    // Skip any other characters (spaces, newlines, etc.)
  }
  
  return result;
}

export function parseCommands(commandString: string): Command[] {
  try {
    // First, extract all function definitions
    const functions = parseFunctions(commandString);
    
    // Expand all function calls (with recursion support)
    const expandedString = expandFunctions(commandString, functions);
    
    // Parse the expanded string into commands
    const commands: Command[] = [];
    for (const char of expandedString.toLowerCase()) {
      if (char === 's' || char === 'l' || char === 'r') {
        commands.push(char as Command);
      }
    }
    return commands;
  } catch (error) {
    // If there's an error (e.g., infinite recursion), return empty commands
    console.error('Error parsing commands:', error);
    throw error;
  }
}

// Execute commands step by step with recursive function support
export function* executeCommandsStepByStep(
  commandString: string,
  initialState: GameState,
  maxSteps: number = 10000
): Generator<GameState, GameState, undefined> {
  const functions = parseFunctions(commandString);
  
  // Get the execution lines (non-definition lines)
  const lines = commandString.split('\n');
  const executionLines = lines.filter(line => !line.trim().match(/^([a-zA-Z]):(.+)$/));
  const mainCommands = executionLines.join('');
  
  let currentState = JSON.parse(JSON.stringify(initialState)) as GameState;
  yield currentState;
  
  let stepCount = 0;
  
  // Process commands character by character with a call stack for recursion
  function* processCommands(commands: string): Generator<GameState, void, undefined> {
    for (let i = 0; i < commands.length; i++) {
      if (currentState.isGameOver || stepCount >= maxSteps) {
        if (stepCount >= maxSteps) {
          currentState.isGameOver = true;
          currentState.message = `⚠️ Maximum steps (${maxSteps}) reached. Check for infinite loops.`;
        }
        return;
      }
      
      const char = commands[i].toLowerCase();
      
      if (char === 's' || char === 'l' || char === 'r') {
        // Execute basic command
        stepCount++;
        executeOneCommand(char as Command, currentState);
        yield JSON.parse(JSON.stringify(currentState));
      } else if (/[a-z]/.test(char) && functions[char]) {
        // Recursively process function call
        yield* processCommands(functions[char]);
      }
    }
  }
  
  yield* processCommands(mainCommands);
  return currentState;
}

// Execute a single command and update the game state
function executeOneCommand(command: Command, state: GameState): void {
  if (state.isGameOver) return;

  if (command === 'l') {
    state.robot.direction = turnLeft(state.robot.direction);
  } else if (command === 'r') {
    state.robot.direction = turnRight(state.robot.direction);
  } else if (command === 's') {
    const nextPos = getNextPosition(state.robot.position, state.robot.direction);
    
    if (!isValidPosition(nextPos, state.grid)) {
      state.isGameOver = true;
      state.message = '💥 Robot hit the wall!';
      return;
    }

    const cellType = state.grid[nextPos.y][nextPos.x];

    if (cellType === '*') {
      state.robot.position = nextPos;
      state.isGameOver = true;
      state.message = '💥 Robot hit a bomb!';
      return;
    }

    if (cellType === 'o') {
      state.grid[nextPos.y][nextPos.x] = '.';
      state.pointsCollected++;
      
      if (state.pointsCollected === state.totalPoints) {
        state.robot.position = nextPos;
        state.isWon = true;
        state.isGameOver = true;
        state.message = '🎉 You collected all points! You won!';
        return;
      }
    }

    state.robot.position = nextPos;
  }
}

export function executeCommands(
  commands: Command[],
  initialState: GameState
): { states: GameState[], finalState: GameState } {
  const states: GameState[] = [{ ...initialState }];
  let currentState = JSON.parse(JSON.stringify(initialState)) as GameState;

  for (const command of commands) {
    if (currentState.isGameOver) break;

    if (command === 'l') {
      currentState.robot.direction = turnLeft(currentState.robot.direction);
    } else if (command === 'r') {
      currentState.robot.direction = turnRight(currentState.robot.direction);
    } else if (command === 's') {
      const nextPos = getNextPosition(currentState.robot.position, currentState.robot.direction);
      
      if (!isValidPosition(nextPos, currentState.grid)) {
        currentState.isGameOver = true;
        currentState.message = '💥 Robot hit the wall!';
        break;
      }

      const cellType = currentState.grid[nextPos.y][nextPos.x];

      if (cellType === '*') {
        currentState.robot.position = nextPos;
        currentState.isGameOver = true;
        currentState.message = '💥 Robot hit a bomb!';
        states.push(JSON.parse(JSON.stringify(currentState)));
        break;
      }

      if (cellType === 'o') {
        currentState.grid[nextPos.y][nextPos.x] = '.';
        currentState.pointsCollected++;
        
        if (currentState.pointsCollected === currentState.totalPoints) {
          currentState.robot.position = nextPos;
          currentState.isWon = true;
          currentState.isGameOver = true;
          currentState.message = '🎉 You collected all points! You won!';
          states.push(JSON.parse(JSON.stringify(currentState)));
          break;
        }
      }

      currentState.robot.position = nextPos;
    }

    states.push(JSON.parse(JSON.stringify(currentState)));
  }

  return { states, finalState: currentState };
}

export function initializeGame(levelData: string): GameState {
  const { grid, robotStart } = parseLevel(levelData);
  const totalPoints = countTotalPoints(grid);

  const initialRobot: RobotState = {
    position: robotStart,
    direction: 'up'
  };

  return {
    grid,
    robot: { ...initialRobot },
    initialRobot,
    pointsCollected: 0,
    totalPoints,
    isGameOver: false,
    isWon: false,
    message: ''
  };
}
