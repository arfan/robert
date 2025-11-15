'use client';

import { useState, useEffect, useRef } from 'react';
import Grid from '@/components/Grid';
import { GameState } from '@/types/game';
import { initializeGame, executeCommandsStepByStep } from '@/utils/gameLogic';

export default function Home() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [commands, setCommands] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(100);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [levelData, setLevelData] = useState<string>('');
  const previousLevelRef = useRef(1);
  const isStoppingRef = useRef(false);

  // Load the selected level and its saved solution
  useEffect(() => {
    const loadLevel = async () => {
      try {
        const response = await fetch(`/level${selectedLevel}.txt`);
        const data = await response.text();
        setLevelData(data);
        const initialState = initializeGame(data);
        setGameState(initialState);
        
        // Load saved solution from localStorage
        const savedSolution = localStorage.getItem(`level${selectedLevel}_solution`);
        setCommands(savedSolution || '');
        
        // Update the previous level ref
        previousLevelRef.current = selectedLevel;
      } catch (error) {
        console.error('Failed to load level:', error);
      }
    };
    loadLevel();
  }, [selectedLevel]);

  // Save solution to localStorage whenever commands change (but not when level changes)
  useEffect(() => {
    // Only save if we're on the same level (not during level switch)
    if (previousLevelRef.current === selectedLevel) {
      localStorage.setItem(`level${selectedLevel}_solution`, commands);
    }
  }, [commands, selectedLevel]);

  // Calculate byte size of solution
  const calculateBytes = (text: string): number => {
    return new TextEncoder().encode(text).length;
  };

  const handleReset = () => {
    if (!gameState || !levelData) return;
    
    const newState = initializeGame(levelData);
    setGameState(newState);
    setIsPlaying(false);
  };

  const handlePlay = async () => {
    if (!gameState || isPlaying || !levelData) return;

    setIsPlaying(true);
    setIsStopping(false);
    isStoppingRef.current = false;
    
    // Reset to starting position first
    const resetState = initializeGame(levelData);
    setGameState(resetState);
    
    // Small delay to show the reset
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      const stateGenerator = executeCommandsStepByStep(commands, resetState);
      
      // Iterate through each state
      for (const state of stateGenerator) {
        // Check if user requested stop (using ref for immediate access)
        if (isStoppingRef.current) {
          break;
        }
        
        setGameState(state);
        await new Promise(resolve => setTimeout(resolve, animationSpeed));
        
        // Stop if game is over
        if (state.isGameOver) {
          break;
        }
      }
    } catch (error) {
      // Handle errors like infinite recursion
      const errorState = { ...resetState };
      errorState.isGameOver = true;
      errorState.message = `❌ Error: ${error instanceof Error ? error.message : 'Invalid commands'}`;
      setGameState(errorState);
    }

    setIsPlaying(false);
    setIsStopping(false);
    isStoppingRef.current = false;
  };

  const handleStop = () => {
    setIsStopping(true);
    isStoppingRef.current = true;
  };

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
          🤖 Robot Maze Game
        </h1>
        <p className="text-center text-gray-600 mb-4">
          Navigate the robot to collect all points without hitting bombs!
        </p>

        {/* Level Selector */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-md p-4 inline-flex gap-2 items-center">
            <label htmlFor="level-select" className="text-gray-700 font-semibold">
              Select Level:
            </label>
            <select
              id="level-select"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(Number(e.target.value))}
              disabled={isPlaying}
              className="px-4 py-2 rounded-lg border-2 border-gray-300 bg-white text-gray-700 font-semibold focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <option value={1}>Level 1</option>
              <option value={2}>Level 2</option>
              <option value={3}>Level 3</option>
              <option value={4}>Level 4</option>
              <option value={5}>Level 5</option>
              <option value={6}>Level 6</option>
              <option value={7}>Level 7</option>
              <option value={18}>Level 18</option>
              <option value={19}>Level 19</option>
              <option value={20}>Level 20</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Game Grid */}
          <div className="flex flex-col items-center">
            <div className="mb-4">
              <Grid
                grid={gameState.grid}
                robotPosition={gameState.robot.position}
                robotDirection={gameState.robot.direction}
              />
            </div>

            {/* Game Stats */}
            <div className="bg-white rounded-lg shadow-md p-4 w-full max-w-md">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700 font-semibold">Points Collected:</span>
                <span className="text-2xl font-bold text-green-600">
                  {gameState.pointsCollected} / {gameState.totalPoints}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 font-semibold">Direction:</span>
                <span className="text-xl font-bold text-blue-600">
                  {gameState.robot.direction.toUpperCase()}
                </span>
              </div>
              {gameState.message && (
                <div className={`mt-4 p-3 rounded-lg text-center font-semibold ${
                  gameState.isWon 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {gameState.message}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Commands</h2>
              
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Enter movement commands:
                  </label>
                  <span className="text-sm font-medium text-blue-600">
                    {calculateBytes(commands)} bytes
                  </span>
                </div>
                <textarea
                  value={commands}
                  onChange={(e) => setCommands(e.target.value)}
                  placeholder="e.g., ssslsssr"
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
                  disabled={isPlaying}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Animation Speed: {animationSpeed}ms
                </label>
                <input
                  type="range"
                  min="50"
                  max="1000"
                  step="50"
                  value={animationSpeed}
                  onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handlePlay}
                  disabled={isPlaying || !commands.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  {isPlaying ? 'Playing...' : '▶ Play'}
                </button>
                <button
                  onClick={handleStop}
                  disabled={!isPlaying}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  ⏹ Stop
                </button>
                <button
                  onClick={handleReset}
                  disabled={isPlaying}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  🔄 Reset
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-lg shadow-md p-6 mt-4">
              <h3 className="text-xl font-bold mb-3 text-gray-800">How to Play</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="font-bold mr-2">s:</span>
                  <span>Move straight (forward one cell)</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2">l:</span>
                  <span>Turn left</span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2">r:</span>
                  <span>Turn right</span>
                </li>
              </ul>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-bold mb-2 text-gray-800">Custom Functions:</h4>
                <p className="text-sm text-gray-600 mb-2">
                  You can define reusable functions:
                </p>
                <div className="bg-gray-50 p-3 rounded font-mono text-sm mb-2">
                  <div>f:ssslsss</div>
                  <div>ff</div>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  This defines function &apos;f&apos; as &apos;ssslsss&apos; and calls it twice, equivalent to: ssslsssssslsss
                </p>
                
                <h5 className="font-bold mb-2 text-gray-700 text-sm">Recursion & Loops:</h5>
                <p className="text-sm text-gray-600 mb-2">
                  Functions can call themselves or other functions!
                </p>
                <div className="bg-gray-50 p-3 rounded font-mono text-sm mb-2">
                  <div>f:sf</div>
                  <div>f</div>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Function &apos;f&apos; calls itself after moving forward (infinite loop until hitting a wall/bomb)
                </p>
                
                <div className="bg-gray-50 p-3 rounded font-mono text-sm mb-2">
                  <div>a:sb</div>
                  <div>b:la</div>
                  <div>a</div>
                </div>
                <p className="text-xs text-gray-500">
                  Functions can call each other: &apos;a&apos; moves and calls &apos;b&apos;, &apos;b&apos; turns left and calls &apos;a&apos; (spiral pattern)
                </p>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-bold mb-2 text-gray-800">Legend:</h4>
                <ul className="space-y-1 text-gray-700">
                  <li>↑ ← ↓ → : Robot (facing direction)</li>
                  <li>💣 : Bomb (avoid!)</li>
                  <li>🟡 : Point (collect all!)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
