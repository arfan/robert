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

// New advanced h-language parser

interface FunctionDef {
  name: string;
  params: string[];  // Parameter names (uppercase letters)
  body: string;      // Function body with unexpanded parameters
}

interface ExecutionContext {
  functions: Map<string, FunctionDef>;
  argValues: Map<string, number | string>;  // Stores both numeric and instruction arguments
}

// Parse function definitions with arguments like f(A,B):body
export function parseFunctionsAdvanced(commandString: string): Map<string, FunctionDef> {
  const functions = new Map<string, FunctionDef>();
  const lines = commandString.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Match: funcName(A,B,...):body or funcName:body
    const matchWithArgs = trimmedLine.match(/^([a-z])\(([A-Z,]+)\):(.+)$/);
    const matchNoArgs = trimmedLine.match(/^([a-z]):(.+)$/);
    
    if (matchWithArgs) {
      const [, funcName, paramStr, body] = matchWithArgs;
      const params = paramStr.split(',').map(p => p.trim());
      functions.set(funcName, { name: funcName, params, body });
    } else if (matchNoArgs) {
      const [, funcName, body] = matchNoArgs;
      functions.set(funcName, { name: funcName, params: [], body });
    }
  }
  
  return functions;
}

// Evaluate numeric expression like "A+1", "B-2", "5", etc.
function evaluateExpression(expr: string, context: ExecutionContext): number {
  expr = expr.trim();
  
  // Handle simple number
  const num = parseInt(expr);
  if (!isNaN(num)) return num;
  
  // Handle variable
  if (/^[A-Z]$/.test(expr)) {
    const value = context.argValues.get(expr);
    return typeof value === 'number' ? value : 0;
  }
  
  // Handle addition: A+1, A+B, etc.
  if (expr.includes('+')) {
    const parts = expr.split('+').map(p => p.trim());
    return parts.reduce((sum, part) => sum + evaluateExpression(part, context), 0);
  }
  
  // Handle subtraction: A-1, A-B, etc.
  if (expr.includes('-')) {
    const parts = expr.split('-').map(p => p.trim());
    if (parts.length === 2) {
      return evaluateExpression(parts[0], context) - evaluateExpression(parts[1], context);
    }
  }
  
  return 0;
}

// Expand a function call with arguments like f(5), f(A-1), f(l), f(sA,B-1)
function expandFunctionCall(
  funcName: string, 
  argsStr: string, 
  context: ExecutionContext,
  depth: number,
  maxDepth: number
): string {
  if (depth > maxDepth) {
    throw new Error(`Maximum recursion depth (${maxDepth}) exceeded.`);
  }
  
  const funcDef = context.functions.get(funcName);
  if (!funcDef) return '';
  
  // Parse arguments
  const args = argsStr ? argsStr.split(',').map(a => a.trim()) : [];
  
  // Check if all numeric arguments are > 0
  let shouldExecute = true;
  const newContext: ExecutionContext = {
    functions: context.functions,
    argValues: new Map(context.argValues)
  };
  
  // Bind arguments to parameter names
  for (let i = 0; i < funcDef.params.length && i < args.length; i++) {
    const paramName = funcDef.params[i];
    const argValue = args[i];
    
    // Try to evaluate as numeric expression
    const numValue = evaluateExpression(argValue, context);
    if (!isNaN(numValue) && argValue.match(/^[0-9A-Z+\-]+$/)) {
      // Numeric argument
      newContext.argValues.set(paramName, numValue);
      if (numValue <= 0) shouldExecute = false;
    } else {
      // Instruction argument
      newContext.argValues.set(paramName, argValue);
    }
  }
  
  // Don't execute if any numeric parameter is <= 0
  if (!shouldExecute) return '';
  
  // Expand the function body
  return expandInstructions(funcDef.body, newContext, depth + 1, maxDepth);
}

// Expand instructions recursively, handling function calls and arguments
function expandInstructions(
  instructions: string,
  context: ExecutionContext,
  depth: number,
  maxDepth: number
): string {
  let result = '';
  let i = 0;
  
  while (i < instructions.length) {
    const char = instructions[i];
    
    // Basic commands
    if (char === 's' || char === 'l' || char === 'r') {
      result += char;
      i++;
    }
    // Uppercase letter - could be instruction argument invocation
    else if (/[A-Z]/.test(char)) {
      const argValue = context.argValues.get(char);
      if (typeof argValue === 'string') {
        // It's an instruction argument, expand it
        result += expandInstructions(argValue, context, depth, maxDepth);
      }
      i++;
    }
    // Lowercase letter - function call
    else if (/[a-z]/.test(char)) {
      // Check if it has arguments: f(...)
      if (i + 1 < instructions.length && instructions[i + 1] === '(') {
        // Find matching closing parenthesis
        let parenCount = 1;
        let j = i + 2;
        while (j < instructions.length && parenCount > 0) {
          if (instructions[j] === '(') parenCount++;
          if (instructions[j] === ')') parenCount--;
          j++;
        }
        const argsStr = instructions.substring(i + 2, j - 1);
        result += expandFunctionCall(char, argsStr, context, depth, maxDepth);
        i = j;
      } else {
        // No arguments, simple function call
        result += expandFunctionCall(char, '', context, depth, maxDepth);
        i++;
      }
    }
    else {
      // Skip other characters (spaces, newlines, etc.)
      i++;
    }
  }
  
  return result;
}

// Old function for backwards compatibility
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
  try {
    // Parse function definitions using advanced parser
    const functions = parseFunctionsAdvanced(commandString);
    
    // Create initial execution context
    const context: ExecutionContext = {
      functions,
      argValues: new Map()
    };
    
    // Get the execution lines (non-definition lines)
    const lines = commandString.split('\n');
    const executionLines = lines.filter(line => {
      const trimmed = line.trim();
      // Skip function definitions like f:body or f(A,B):body
      return !trimmed.match(/^([a-z])\s*(\([A-Z,\s]*\))?\s*:/);
    });
    const mainCommands = executionLines.join('');
    
    // Expand the main commands using the advanced parser
    const expandedCommands = expandInstructions(mainCommands, context, 0, 1000);
    
    let currentState = JSON.parse(JSON.stringify(initialState)) as GameState;
    yield currentState;
    
    let stepCount = 0;
    
    // Process the expanded commands character by character
    for (let i = 0; i < expandedCommands.length; i++) {
      if (currentState.isGameOver || stepCount >= maxSteps) {
        if (stepCount >= maxSteps) {
          currentState.isGameOver = true;
          currentState.message = `⚠️ Maximum steps (${maxSteps}) reached. Check for infinite loops.`;
        }
        break;
      }
      
      const char = expandedCommands[i].toLowerCase();
      
      if (char === 's' || char === 'l' || char === 'r') {
        // Execute basic command
        stepCount++;
        executeOneCommand(char as Command, currentState);
        yield JSON.parse(JSON.stringify(currentState));
      }
    }
    
    return currentState;
  } catch (error) {
    // If there's an error (e.g., infinite recursion), mark game as over
    const errorState = JSON.parse(JSON.stringify(initialState)) as GameState;
    errorState.isGameOver = true;
    errorState.message = error instanceof Error ? `⚠️ ${error.message}` : '⚠️ Error parsing commands';
    yield errorState;
    return errorState;
  }
}

// Helper function to check if a cell is a wall (uppercase letters)
function isWall(cellType: CellType): boolean {
  return /^[A-K]$/.test(cellType);
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

    // Check for non-destructive walls (uppercase letters)
    if (isWall(cellType)) {
      // Robot stays in place, continue execution
      return;
    }

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
