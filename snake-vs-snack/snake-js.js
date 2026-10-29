/**
 * Snake-JS
 * 
 * By Didrik Nordstrom, http://betamos.se
 * Follow the project on github: http://github.com/betamos/Snake-JS
 * MIT Licensed
 *
 * Modified for the "snake-vs-snack" demo (escaping candy mode, WASD input,
 * restart/destroy API, win state, labelled score board). See CHANGES.md.
 */

/**
 * MAIN GAME OBJECT
 *
 * Everything associated with the snake game should be encapsulated within
 * this function to avoid pollution of the global namespace
 */
function SnakeJS(parentElement, config){

	var utilities = new Utilities();

	var defaultConfig = {
		autoInit : true,					// Game inits automagically
		gridWidth : 30,						// Width of the game grid
		gridHeight : 20,					// Height of the game grid
		frameInterval : 150,				// Milliseconds between frames (@todo change to speed?)
		pointSize : 16,						// Size of one grid point
		backgroundColor : "white",			// Color of the background. CSS3 color values
		snakeColor : "#4b4312",				// Color of the snake
		snakeEyeColor : "white",			// Color of the snake's eye
		candyColor : "#b11c1c",				// Color of the candy
		shrinkingCandyColor : "#199C2C",	// Color of the special candy that shrinks
		scoreBoardColor : "#c0c96b",		// Color of the score board
		scoreTextColor : "#4b4312",			// Color of the score numbers on the score board
		scoreBoardHeight : 20,				// Height of the score board in pixels
		scoreLabel : "Score",				// Label drawn next to the score
		highScoreLabel : "Best",			// Label drawn next to the high score
		gridLineColor : null,				// Optional color for faint grid lines (null = none)
		winMessage : "YOU WIN",				// Message shown when the board is full
		collisionTolerance : 1,				// Still frames before collision. More = easier
		onUpdate : null,					// Optional callback(stateSnapshot) after every redraw
		initialLength : 1,					// Cells the snake starts with (upstream: 1 cell growing to 7)
		growthPerCandy : null,				// Cells gained per candy; null = upstream per-type calories (3/5/0)

		// Escaping candy mode (snake-vs-snack). All tunable.
		escapingCandy : false,				// false = classic (candy never moves), true = candy flees
		escapeDistance : 4,					// Candy flees only while Manhattan distance to the head is BELOW this
		escapeEveryNMoves : 3,				// Candy may step at most once per this many snake moves
		candyEyeColor : "white",			// Eye color of a scared candy
		candyPupilColor : "#111111"			// Pupil color of a scared candy
	};

	// Merge user config with default config
	var config = config ? utilities.mergeObjects(defaultConfig, config) : defaultConfig ;

	var constants = {
		DIRECTION_UP : 1,
		DIRECTION_RIGHT : 2,
		DIRECTION_DOWN : -1,
		DIRECTION_LEFT : -2,
		DEFAULT_DIRECTION : 2,
		STATE_READY : 1,
		STATE_PAUSED : 2,
		STATE_PLAYING : 3,
		STATE_GAME_OVER : 4,
		STATE_WON : 5,
		STATE_DESTROYED : 6,
		INITIAL_SNAKE_GROWTH_LEFT : 6,
		SCOREBOARD_HEIGHT : config.scoreBoardHeight,
		CANDY_REGULAR : 1,
		CANDY_MASSIVE : 2,
		CANDY_SHRINKING : 3
	};

	var engine = new Engine(parentElement);

	/**
	 * These methods below (init, pause, resume) are publically accessible.
	 */
	this.init = function(){
		engine.initGame();
	};

	this.pause = function(){
		engine.pauseGame();
	};

	this.resume = function(){
		engine.resumeGame();
	};

	this.getHighScore = function(){
		return engine.getHighScore();
	};

	this.getScore = function(){
		return engine.getScore();
	};

	// Stop every timer, remove every listener and the canvas. The object is
	// unusable afterwards; create a new SnakeJS to play again.
	this.destroy = function(){
		engine.destroy();
	};

	// Plain-data snapshot of the game state (for the page UI and tests).
	this.getState = function(){
		return engine.getState();
	};

	// Steer the snake from code (touch controls, on-screen buttons).
	// direction is "up", "down", "left" or "right". Starts the game when READY.
	this.steer = function(direction){
		engine.steer(direction);
	};

	/**
	 * GAME MODEL OBJECT
	 *
	 * This object is doing the game logic, frame management etc.
	 */
	function Engine(parentElement) {
		
		var snake,					// The snake itself
			candy,					// The candy which the snake eats
			view,					// The view object which draws the points to screen
			inputInterface,			// Responsible for handling input from the user
			grid,					// The grid object
			currentState,			// Possible values are found in constants.STATE_*
			frameIntervalId,		// The ID of the interval timer
			score,					// Player score
			highScore,				// Player highScore
			collisionFramesLeft,	// If the snake collides, how many frames are left until death
			movesSinceCandyStep,	// Escaping candy: snake moves since the candy last stepped
			pendingTimeouts = [];	// Timeout IDs of the game over animation (cleared on destroy)

		var engineSelf = this;

		this.initGame = function(){

			view = new View(parentElement, config.backgroundColor);
			inputInterface = new InputInterface(this.pauseGame, this.resumeGame, startMoving);

			snake = new Snake();
			grid = new Grid(config.gridWidth, config.gridHeight);
			score = 0;
			highScore = score;

			// Create snake body
			createSnakeBody();

			candy = randomCandy();
			movesSinceCandyStep = 0;
			updateCandyMood();

			view.initPlayField();
			currentState = constants.STATE_READY;
			drawCurrentScene();
			inputInterface.startListening();
		};

		this.getScore = function(){
			return score;
		};

		this.steer = function(direction){
			var map = {
				up : constants.DIRECTION_UP,
				right : constants.DIRECTION_RIGHT,
				down : constants.DIRECTION_DOWN,
				left : constants.DIRECTION_LEFT
			};
			if (inputInterface && map.hasOwnProperty(direction))
				inputInterface.setDirection(map[direction]);
		};

		this.destroy = function(){
			clearInterval(frameIntervalId);
			while (pendingTimeouts.length > 0)
				clearTimeout(pendingTimeouts.pop());
			if (inputInterface)
				inputInterface.stopListening();
			if (view)
				view.destroy();
			currentState = constants.STATE_DESTROYED;
		};

		this.getState = function(){
			var points = [];
			for (var i = 0; i < snake.points.length; i++)
				points.push({ left : snake.points[i].left, top : snake.points[i].top });
			return {
				mode : config.escapingCandy ? "escaping" : "classic",
				state : currentState,
				score : score,
				highScore : highScore,
				snake : points,
				direction : snake.direction,
				growthLeft : snake.growthLeft,
				alive : snake.alive,
				candy : candy ? {
					left : candy.point.left,
					top : candy.point.top,
					type : candy.type,
					scared : candy.scared
				} : null,
				movesSinceCandyStep : movesSinceCandyStep,
				gridWidth : grid.width,
				gridHeight : grid.height
			};
		};

		this.pauseGame = function(){
			if (currentState === constants.STATE_PLAYING) {
				clearInterval(frameIntervalId);
				currentState = constants.STATE_PAUSED;
			}
		};

		this.resumeGame = function(){
			if (currentState === constants.STATE_PAUSED) {
				frameIntervalId = setInterval(nextFrame, config.frameInterval);
				currentState = constants.STATE_PLAYING;
			}
		};

		this.getHighScore = function(){
			return highScore;
		};

		/**
		 * Private methods below
		 */

		// Play a game over scene and restart the game
		var gameOver = function(){
			currentState = constants.STATE_GAME_OVER;
			clearInterval(frameIntervalId);

			// Remove one point from the snakes tail and recurse with a timeout
			var removeTail = function(){
				if (snake.points.length > 1) {
					snake.points.pop();
					drawCurrentScene();
					pendingTimeouts.push(setTimeout(removeTail, config.frameInterval/4));
				}
				else
					pendingTimeouts.push(setTimeout(resurrect, config.frameInterval * 10));
			};

			var resurrect = function (){
				pendingTimeouts.length = 0;
				score = 0;
				createSnakeBody();
				snake.alive = true;
				movesSinceCandyStep = 0;
				updateCandyMood();
				currentState = constants.STATE_READY;
				drawCurrentScene();
			};

			pendingTimeouts.push(setTimeout(removeTail, config.frameInterval * 10));
		};

		// Give the snake its starting body: config.initialLength cells in a
		// horizontal row with the head on the right, so the default direction
		// (right) is always safe. Upstream started with one cell and
		// INITIAL_SNAKE_GROWTH_LEFT frames of growth; with initialLength 1 that
		// behaviour is kept.
		var createSnakeBody = function(){
			var length = Math.max(1, Math.min(config.initialLength, grid.width));
			// randomInteger(0, n) yields 0..n, so the head lands in [length-1, width-1]
			var head = new Point(length - 1 + utilities.randomInteger(0, grid.width - length),
			                     utilities.randomInteger(0, grid.height - 1));
			snake.points = [];
			for (var i = 0; i < length; i++)
				snake.points.push(new Point(head.left - i, head.top));
			snake.direction = constants.DEFAULT_DIRECTION;
			snake.growthLeft = (config.initialLength === 1) ? constants.INITIAL_SNAKE_GROWTH_LEFT : 0;
		};

		// The board is full: there is no free cell left for a candy.
		var winGame = function(){
			currentState = constants.STATE_WON;
			clearInterval(frameIntervalId);
			drawCurrentScene();
		};

		var startMoving = function(){
			if (currentState === constants.STATE_READY) {
				frameIntervalId = setInterval(nextFrame, config.frameInterval);
				currentState = constants.STATE_PLAYING;
			}
		};

		// Calculates what the next frame will be like and draws it.
		var nextFrame = function(){

			// If the snake can't be moved in the desired direction due to collision
			if (!moveSnake(inputInterface.lastDirection())) {
				if (collisionFramesLeft > 0) {
					// Survives for a little longer
					collisionFramesLeft--;
					return;
				}
				else {
					// Now it's dead
					snake.alive = false;
					// Draw the dead snake
					drawCurrentScene();
					// And play game over scene
					gameOver();
					return;
				}
			}
			// It can move.
			else
				collisionFramesLeft = config.collisionTolerance;

			// One more snake move since the candy last stepped
			movesSinceCandyStep++;

			if (!candy.age()) {
				// The candy disappeared by ageing
				candy = randomCandy();
				movesSinceCandyStep = 0;
			}

			// If the snake hits a candy. This is checked BEFORE the candy may
			// flee, so a candy the head just reached is always eaten.
			if(candy && candy.point.collidesWith(snake.points[0])) {
				eatCandy();
				candy = randomCandy();
				movesSinceCandyStep = 0;
			}

			if (!candy) {
				// No free cell is left on the board
				winGame();
				return;
			}

			// Escaping candy mode: the candy tries to get away from the head
			if (config.escapingCandy)
				fleeCandy();

			drawCurrentScene();
		};

		// ESCAPING CANDY
		// Runs once per successful snake move, after the eat check.
		// - The candy is "scared" while the Manhattan distance to the head is
		//   below config.escapeDistance. A calm candy never moves.
		// - A scared candy steps one cell (up/down/left/right) at most once per
		//   config.escapeEveryNMoves snake moves.
		// - It may only step to a cell inside the grid that is not covered by the
		//   snake, and only if that cell increases the distance to the head.
		//   Among the best cells one is picked at random. Trapped candy stays put.
		var fleeCandy = function(){
			var head = snake.points[0];
			var currentDistance = manhattanDistance(head, candy.point);

			updateCandyMood();

			if (!candy.scared)
				return;
			if (movesSinceCandyStep < config.escapeEveryNMoves)
				return;

			var directions = [constants.DIRECTION_UP, constants.DIRECTION_RIGHT,
			                  constants.DIRECTION_DOWN, constants.DIRECTION_LEFT];
			var bestDistance = currentDistance;
			var bestPoints = [];

			for (var i = 0; i < directions.length; i++) {
				var candidate = movePoint(candy.point, directions[i]);
				// Never outside the walls (the candy does not wrap like the snake)
				if (!insideGrid(candidate, grid))
					continue;
				// Never onto the head or the body
				if (snake.collidesWith(candidate))
					continue;
				var distance = manhattanDistance(head, candidate);
				if (distance > bestDistance) {
					bestDistance = distance;
					bestPoints = [candidate];
				}
				else if (distance === bestDistance && distance > currentDistance) {
					bestPoints.push(candidate);
				}
			}

			if (bestPoints.length === 0)
				return;

			candy.point = bestPoints[utilities.randomInteger(0, bestPoints.length - 1)];
			movesSinceCandyStep = 0;
		};

		// Is the candy scared (head closer than config.escapeDistance)? Also
		// remembers which way is "away from the head" for the eyes. Evaluated
		// before the candy steps, so a candy that just ran away still looks scared.
		var updateCandyMood = function(){
			if (!candy)
				return;
			if (!config.escapingCandy) {
				candy.scared = false;
				return;
			}
			var head = snake.points[0];
			candy.scared = manhattanDistance(head, candy.point) < config.escapeDistance;
			candy.fleeVector = {
				left : utilities.sign(candy.point.left - head.left),
				top : utilities.sign(candy.point.top - head.top)
			};
		};

		var manhattanDistance = function(a, b){
			return Math.abs(a.left - b.left) + Math.abs(a.top - b.top);
		};

		var drawCurrentScene = function() {
			// Clear the view to make room for a new frame
			view.clear();
			// Draw the objects to the screen
			view.drawSnake(snake, config.snakeColor);
			if (candy)
				view.drawCandy(candy);
			view.drawScore(score, highScore);
			if (currentState === constants.STATE_WON)
				view.drawMessage(config.winMessage);
			if (typeof config.onUpdate === "function")
				config.onUpdate(engineSelf.getState());
		};

		// Move the snake. Automatically handles self collision and walking through walls
		var moveSnake = function(desiredDirection){
			var head = snake.points[0];

			// The direction the snake will move in this frame
			var newDirection = actualDirection(desiredDirection || constants.DEFAULT_DIRECTION);

			var newHead = movePoint(head, newDirection);

			if (!insideGrid(newHead, grid))
				shiftPointIntoGrid(newHead, grid);

			if (snake.collidesWith(newHead, true)) {
				// Can't move. Collides with itself
				return false;
			}

			snake.direction = newDirection;
			snake.points.unshift(newHead);

			if (snake.growthLeft >= 1)
				snake.growthLeft--;
			else
				snake.points.pop();
			
			return true;
		};

		var eatCandy = function(){
			score += candy.score;
			highScore = Math.max(score, highScore);
			snake.growthLeft += (config.growthPerCandy === null) ? candy.calories : config.growthPerCandy;
		};

		// Returns a new candy on a random free cell, or null when the board is full
		var randomCandy = function() {
			// Find a new position for the candy, and make sure it's not inside the snake.
			// Collect the free cells first so a full board cannot loop forever.
			var freePoints = [];
			for (var top = 0; top < grid.height; top++) {
				for (var left = 0; left < grid.width; left++) {
					var point = new Point(left, top);
					if (!snake.collidesWith(point))
						freePoints.push(point);
				}
			}
			if (freePoints.length === 0)
				return null;
			var newCandyPoint = freePoints[utilities.randomInteger(0, freePoints.length - 1)];
			// Gives a float number between 0 and 1
			var probabilitySeed = Math.random();
			if (probabilitySeed < 0.75)
				var newType = constants.CANDY_REGULAR;
			else if (probabilitySeed < 0.95)
				var newType = constants.CANDY_MASSIVE;
			else
				var newType = constants.CANDY_SHRINKING;
			return new Candy(newCandyPoint, newType);
		};

		// Get the direction which the snake will go this frame
		// The desired direction is usually provided by keyboard input
		var actualDirection = function(desiredDirection){
			if (snake.points.length === 1)
				return desiredDirection;
			else if (utilities.oppositeDirections(snake.direction, desiredDirection)) {
				// Continue moving in the snake's current direction
				// ignoring the player
				return snake.direction;
			}
			else {
				// Obey the player and move in that direction
				return desiredDirection;
			}
		};

		// Take a point (oldPoint), "move" it in any direction (direction) and
		// return a new point (newPoint) which corresponds to the change
		// Does not care about borders, candy or walls. Just shifting position.
		var movePoint = function(oldPoint, direction){
			var newPoint;
			with (constants) {
				switch (direction) {
				case DIRECTION_LEFT:
					newPoint = new Point(oldPoint.left-1, oldPoint.top);
					break;
				case DIRECTION_UP:
					newPoint = new Point(oldPoint.left, oldPoint.top-1);
					break;
				case DIRECTION_RIGHT:
					newPoint = new Point(oldPoint.left+1, oldPoint.top);
					break;
				case DIRECTION_DOWN:
					newPoint = new Point(oldPoint.left, oldPoint.top+1);
					break;
				}
			}
			return newPoint;
		};

		// Shifts the points position so that it it is kept within the grid
		// making it possible to "go thru" walls
		var shiftPointIntoGrid = function(point, grid){
			point.left = shiftIntoRange(point.left, grid.width);
			point.top = shiftIntoRange(point.top, grid.height);
			return point;
		};

		// Helper function for shiftPointIntoGrid
		// E.g. if number=23, range=10, returns 3
		// E.g.2 if nubmer = -1, range=10, returns 9
		var shiftIntoRange = function(number, range) {
			var shiftedNumber, steps;
			if (utilities.sign(number) == 1){
				steps = Math.floor(number/range);
				shiftedNumber = number - (range * steps);
			}
			else if (utilities.sign(number) == -1){
				steps = Math.floor(Math.abs(number)/range) + 1;
				shiftedNumber = number + (range * steps);
			}
			else {
				shiftedNumber = number;
			}
			return shiftedNumber;
		};

		// Check if a specific point is inside the grid
		// Returns true if inside, false otherwise
		var insideGrid = function(point, grid){
			if (point.left < 0 || point.top < 0 ||
					point.left >= grid.width || point.top >= grid.height){
				return false;
			}
			else {
				return true;
			}
		};

		// Returns a point object with randomized coordinates within the grid
		var randomPoint = function(grid){
			var left = utilities.randomInteger(0, grid.width - 1);
			var top = utilities.randomInteger(0, grid.height - 1);
			var point = new Point(left, top);
			return point;
		};
	}

	/**
	 * GRID OBJECT
	 *
	 * This object holds the properties of the grid.
	 */
	function Grid(width, height) {
		this.width = width;
		this.height = height;
	}

	/**
	 * SNAKE OBJECT
	 *
	 * The snake itself...
	 */
	function Snake() {
		this.direction = constants.DEFAULT_DIRECTION;
		this.points = [];
		this.growthLeft = 0;
		this.alive = true;

		// Check if any of this objects points collides with an external point
		// Returns true if any collision occurs, false otherwise
		// @param simulateMovement boolean Simulates the removal of the end point
		// This addresses a bug where the snake couldn't move to a point which
		// is not currently free, but will be in the next frame
		this.collidesWith = function(point, simulateMovement){
			var range;
			if (simulateMovement && this.growthLeft === 0)
				// Now th
				range = this.points.length - 1;
			else
				range = this.points.length;
			for (var i = 0; i < range; i++) {
				if (point.collidesWith(this.points[i]))
					return true;
			}
			return false;
		};
	}

	/**
	 * POINT OBJECT
	 *
	 * A point has a place in the grid and can be passed
	 * to View for drawing.
	 */
	function Point(left, top) {
		this.left = left;
		this.top = top;

		// Check if this point collides with another
		this.collidesWith = function(otherPoint){
			if (otherPoint.left == this.left && otherPoint.top == this.top)
				return true;
			else
				return false;
		};
	}

	/**
	 * CANDY OBJECT
	 * 
	 * @param point The point object which determines the position of the candy
	 * @param type Any type defined in constants.CANDY_*
	 */
	function Candy(point, type){
		this.point = point,
		this.type = type,
		this.score,			// Increment in score when eaten by snake
		this.calories,		// How much growth the snake gains if it eats this candy
		this.radius,		// Radius of the candy, relative to config.pointSize
		this.color,			// Color of the candy
		this.decrement,		// If greater than 0, the radius of the candy will shrink...
		this.minRadius;		// until it reaches this minimum value. Then it will disappear
		this.scared = false;			// Escaping mode: true while the snake's head is close
		this.fleeVector = null;			// Escaping mode: {left, top} signs pointing away from the head

		switch (type) {
		case constants.CANDY_REGULAR:
			this.score = 5;
			this.calories = 3;
			this.radius = 0.38;
			this.color = config.candyColor;
			break;
		case constants.CANDY_MASSIVE:
			this.score = 15;
			this.calories = 5;
			this.radius = 0.45;
			this.color = config.candyColor;
			break;
		case constants.CANDY_SHRINKING:
			this.score = 50;
			this.calories = 0;
			this.radius = 0.45;
			this.color = config.shrinkingCandyColor;
			this.decrement = 0.008;
			this.minRadius = 0.05;
			break;
		}

		// Shrinks a CANDY_SHRINKING candy. Returns false if candy is below minRadius
		this.age = function(){
			// Currently only CANDY_SHRINKING reacts to ageing
			if (this.type === constants.CANDY_SHRINKING) {
				this.radius -= this.decrement;
				if (this.radius < this.minRadius)
					return false;
				else
					return true;
			}
			else
				return true;
		};
	};
	
	/**
	 * UTILITIES OBJECT
	 *
	 * Provides some utility methods which don't fit anywhere else.
	 */
	function Utilities() {

		// Takes a number and returns the sign of it.
		// E.g. -56 -> -1, 57 -> 1, 0 -> 0
		this.sign = function(number){
			if(number > 0)
				return 1;
			else if (number < 0)
				return -1;
			else if (number === 0)
				return 0;
			else
				return undefined;
		};

		// Helper function to find if two directions are in opposite to each other
		// Returns true if the directions are in opposite to each other, false otherwise
		this.oppositeDirections = function(direction1, direction2){
	
			// @see Declaration of constants to understand.
			// E.g. UP is defined as 1 while down is defined as -1
			if (Math.abs(direction1) == Math.abs(direction2) &&
					this.sign(direction1 * direction2) == -1) {
				return true;
			}
			else {
				return false;
			}
		};

		// Merge two flat objects and return the modified object.
		this.mergeObjects = function mergeObjects(slave, master){
			var merged = {};
			for (key in slave) {
				if (typeof master[key] === "undefined")
					merged[key] = slave[key];
				else
					merged[key] = master[key];
			}
			return merged;
		};

		// Returns an integer between min and max, including both min and max
		this.randomInteger = function(min, max){
			var randomNumber = min + Math.floor(Math.random() * (max + 1));
			return randomNumber;
		};
	}

	/**
	 * VIEW OBJECT
	 *
	 * This object is responsible for drawing the objects to the screen.
	 * It uses the HTML5 Canvas element for drawing.
	 */
	function View(parentElement, backgroundColor) {
		var playField,			// The DOM <canvas> element
			ctx,				// The canvas context
			snakeThickness;		// The thickness of the snake in pixels

		this.initPlayField = function(){
			snakeThickness = length(0.9);

			playField = document.createElement("canvas");
			playField.setAttribute("id", "snake-js");
			playField.setAttribute("width", config.gridWidth * config.pointSize);
			playField.setAttribute("height", config.gridHeight * config.pointSize + constants.SCOREBOARD_HEIGHT);
			parentElement.appendChild(playField);
			ctx = playField.getContext("2d");
			// Translate the coordinates so that we don't need to care about the scoreboard
			// when we draw all the other stuff
			ctx.translate(0, constants.SCOREBOARD_HEIGHT);
		};

		// Draw the snake to screen
		this.drawSnake = function(snake, color){

			// If there is only one point
			if (snake.points.length === 1) {
				var position = getPointPivotPosition(snake.points[0]);

				ctx.fillStyle = color;
				ctx.beginPath();
				ctx.arc(position.left, position.top, snakeThickness/2, 0, 2*Math.PI, false);
				ctx.fill();
			}
			else {
				// Prepare drawing
				ctx.strokeStyle = color;
				ctx.lineWidth = snakeThickness;
				ctx.lineJoin = "round";
				ctx.lineCap = "round";
				
				// Bein path drawing.
				ctx.beginPath();
				
				// Loop over the points, beginning with the head
				for (var i = 0; i < snake.points.length; i++) {
	
					// Short name for the point we're looking at now
					var currentPoint = snake.points[i];
	
					// If we're looking at the head
					if (i === 0) {
						// The position of this point in screen pixels
						var currentPointPosition = getPointPivotPosition(currentPoint);
						// Don't draw anything, just move the "pencil" to the position of the head
						ctx.moveTo(currentPointPosition.left, currentPointPosition.top);
					}
					// If we're looking at any other point
					else {
						// Short name to the previous point (which we looked at in the last iteration)
						var prevPoint = snake.points[i-1];
	
						// If these points are next to each other (Snake did NOT go through the wall here)
						if(Math.abs(prevPoint.left - currentPoint.left) <= 1 && Math.abs(prevPoint.top - currentPoint.top) <= 1){
							// The position of this point in screen pixels
							var currentPointPosition = getPointPivotPosition(currentPoint);
							// Draw pencil from the position of the "pencil" to this point
							ctx.lineTo(currentPointPosition.left, currentPointPosition.top);
						}
						// If these points are far away from each other (Snake went through wall here)
						else {
							// Connect these points together. This method will simulate wall entrance/exit if necessary
							connectWallPoints(prevPoint, currentPoint);
						}
					}
				}
				// Now draw the snake to screen
				ctx.stroke();
			}

			// Draw the eye of the snake
			drawEye(snake, snake.direction);
		};

		this.drawCandy = function(candy){

			ctx.fillStyle = candy.color;

			var position = getPointPivotPosition(candy.point);

			ctx.beginPath();

			ctx.arc(position.left, position.top, length(candy.radius), 0, Math.PI*2, false);
			ctx.fill();

			// A scared candy gets two eyes whose pupils look away from the snake
			if (candy.scared)
				drawCandyEyes(position, candy);
		};

		var drawCandyEyes = function(position, candy){
			var eyeOffsetLeft = length(0.15);
			var eyeOffsetTop = length(0.08);
			var eyeRadius = length(0.11);
			var pupilRadius = length(0.055);
			var pupilShift = length(0.035);
			var flee = candy.fleeVector || { left : 0, top : 0 };

			for (var side = -1; side <= 1; side += 2) {
				var eyeLeft = position.left + side * eyeOffsetLeft;
				var eyeTop = position.top - eyeOffsetTop;

				ctx.beginPath();
				ctx.fillStyle = config.candyEyeColor;
				ctx.arc(eyeLeft, eyeTop, eyeRadius, 0, Math.PI*2, false);
				ctx.fill();

				ctx.beginPath();
				ctx.fillStyle = config.candyPupilColor;
				ctx.arc(eyeLeft + flee.left * pupilShift, eyeTop + flee.top * pupilShift,
						pupilRadius, 0, Math.PI*2, false);
				ctx.fill();
			}
		};

		this.clear = function(color) {
			ctx.fillStyle = color || backgroundColor;
			ctx.fillRect(0, 0,
					config.gridWidth * config.pointSize,
					config.gridHeight * config.pointSize);

			// Optional faint grid lines
			if (config.gridLineColor) {
				ctx.strokeStyle = config.gridLineColor;
				ctx.lineWidth = 1;
				ctx.beginPath();
				for (var x = 1; x < config.gridWidth; x++) {
					ctx.moveTo(x * config.pointSize + 0.5, 0);
					ctx.lineTo(x * config.pointSize + 0.5, config.gridHeight * config.pointSize);
				}
				for (var y = 1; y < config.gridHeight; y++) {
					ctx.moveTo(0, y * config.pointSize + 0.5);
					ctx.lineTo(config.gridWidth * config.pointSize, y * config.pointSize + 0.5);
				}
				ctx.stroke();
			}
		};

		// Draw a centered message over the play field (e.g. when the board is full)
		this.drawMessage = function(text){
			var width = config.gridWidth * config.pointSize;
			var height = config.gridHeight * config.pointSize;
			ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
			ctx.fillRect(0, 0, width, height);
			ctx.fillStyle = config.candyEyeColor;
			ctx.font = "bold " + Math.round(config.pointSize * 1.6) + "px 'Courier new', monospace";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(text, width / 2, height / 2);
			ctx.textBaseline = "alphabetic";
		};

		// Remove the canvas from the page
		this.destroy = function(){
			if (playField && playField.parentNode)
				playField.parentNode.removeChild(playField);
			playField = null;
		};

		this.drawScore = function(score, highScore){
			// Translate to 0, 0 to draw from origo
			ctx.translate(0, -1 * constants.SCOREBOARD_HEIGHT);

			var fontSize = Math.max(16, Math.round(constants.SCOREBOARD_HEIGHT * 0.55));
			var bottomMargin = Math.round((constants.SCOREBOARD_HEIGHT - fontSize) / 2) + 2;
			var horizontalMargin = Math.round(fontSize / 2);

			// Draw the score board
			ctx.fillStyle = config.scoreBoardColor;
			ctx.fillRect(0, 0, config.gridWidth * config.pointSize, constants.SCOREBOARD_HEIGHT);

			// Prepare drawing text
			ctx.fillStyle = config.scoreTextColor;
			ctx.font = "bold " + fontSize + "px 'Courier new', monospace";

			// Draw score to the upper right corner
			ctx.textAlign = "right";
			ctx.fillText(config.scoreLabel + " " + score, config.gridWidth * config.pointSize - horizontalMargin, constants.SCOREBOARD_HEIGHT - bottomMargin);

			// Draw high score to the upper left corner
			ctx.textAlign = "left";
			ctx.fillText(config.highScoreLabel + " " + highScore, horizontalMargin, constants.SCOREBOARD_HEIGHT - bottomMargin);

			// Translate back
			ctx.translate(0, constants.SCOREBOARD_HEIGHT);
		};

		// Draw the eye of the snake
		var drawEye = function(snake) {
			var head = snake.points[0];
			var headPosition = getPointPivotPosition(head);

			// Imagine the snake going from right to left.
			// These values determine how much to the left and top the eye's pivot point is adjusted.
			var offsetLeft = length(0.125);
			var offsetTop = length(0.15);

			// Place the eye's pivot point differentely depending on which direction the snake moves
			switch (snake.direction){
			case constants.DIRECTION_LEFT:
				headPosition.left -= offsetLeft;
				headPosition.top -= offsetTop;
				break;
			case constants.DIRECTION_RIGHT:
				headPosition.left += offsetLeft;
				headPosition.top -= offsetTop;
				break;
			case constants.DIRECTION_UP:
				headPosition.left -= offsetTop;
				headPosition.top -= offsetLeft;
				break;
			case constants.DIRECTION_DOWN:
				headPosition.left += offsetTop;
				headPosition.top += offsetLeft;
				break;
			}

			// If the snake is still alive draw a circle
			if (snake.alive) {
				ctx.beginPath();
				ctx.fillStyle = config.snakeEyeColor;
				// Draw the circle
				ctx.arc(headPosition.left, headPosition.top, length(0.125), 0, Math.PI*2, false);
				// And fill it
				ctx.fill();
			}
			// If the snake is dead, draw a cross
			else {
				ctx.beginPath();
				ctx.strokeStyle = config.snakeEyeColor;
				ctx.lineWidth = 2;
				ctx.moveTo(headPosition.left - length(0.1), headPosition.top - length(0.1));
				ctx.lineTo(headPosition.left + length(0.1), headPosition.top + length(0.1));
				ctx.moveTo(headPosition.left + length(0.1), headPosition.top - length(0.1));
				ctx.lineTo(headPosition.left - length(0.1), headPosition.top + length(0.1));
				ctx.stroke();
			}
		};

		// Short name to scale a length relative to config.pointSize
		var length = function(value){
			return value * config.pointSize;
		};

		var getPointPivotPosition = function(point) {
			var position = {
					left : point.left * length(1) + length(.5),
					top : point.top * length(1) + length(.5)
			};
			return position;
		};

		// Connect two points in opposite sides of the grid. Makes lines like Snake went through the wall
		// Presumes that the "pencil" is moved to position of p1
		var connectWallPoints = function(p1, p2) {

			// The position of these points in screen pixels
			var p2Position = getPointPivotPosition(p2);

			// This holds -1 or 1 if points are separated horizontally, else 0
			var leftOffset = utilities.sign(p2.left - p1.left);
			// This holds -1 or 1 if points are separated vertically, else 0
			var topOffset = utilities.sign(p2.top - p1.top);

			// First let's look at p1
			// Create a fake end point outside the grid, next to p1
			var fakeEndPoint = new Point(p1.left - leftOffset, p1.top - topOffset);
			// And get the screen position
			var fakeEndPointPosition = getPointPivotPosition(fakeEndPoint);
			// End the current line (which was initially drawn outside this method) in this fake point
			ctx.lineTo(fakeEndPointPosition.left, fakeEndPointPosition.top);

			// Let's look at p2. Create a fakepoint again and get it's position...
			var fakeStartPoint = new Point(p2.left + leftOffset, p2.top + topOffset);
			var fakeStartPointPosition = getPointPivotPosition(fakeStartPoint);
			// ...But this time, first move the pencil (without making a line) to the fake point
			ctx.moveTo(fakeStartPointPosition.left, fakeStartPointPosition.top);
			// Then make a line to p2. Note that these lines are not drawn, since this method
			// only connects the lines, the drawing is handled outside this method
			ctx.lineTo(p2Position.left, p2Position.top);
		};
	}

	/**
	 * INPUTINTERFACE OBJECT
	 * 
	 * Takes input from the user, typically key strokes to steer the snake but also window events
	 * 
	 * @param pauseFn A callback function to be executed when the window is blurred
	 * @param resumeFn A callback function which executes when the window is in focus again
	 * @param autoPlayFn A callback function which executes when any arrow key is pressed
	 */
	function InputInterface(pauseFn, resumeFn, autoPlayFn){

		var arrowKeys = [37, 38, 39, 40],	// Key codes for the arrow keys on a keyboard
			listening = false,				// Listening right now for key strokes etc?
			lastDirection = null;			// Corresponds to the last arrow key pressed

		/**
		 * Public methods below
		 */

		this.lastDirection = function(){
			return lastDirection;
		};

		// Set the direction from outside (touch/swipe/on-screen buttons).
		// Behaves like an arrow key press, including auto play.
		this.setDirection = function(direction){
			lastDirection = direction;
			autoPlayFn();
		};

		// Start listening for player events
		this.startListening = function(){
			if (!listening) {
				window.addEventListener("keydown", handleKeyDown, true);
				window.addEventListener("keypress", disableKeyPress, true);
				window.addEventListener("blur", pauseFn, true);
				window.addEventListener("focus", resumeFn, true);
				listening = true;
			}
		};

		// Stop listening for events. Typically called at game end
		this.stopListening = function(){
			if (listening) {
				window.removeEventListener("keydown", handleKeyDown, true);
				window.removeEventListener("keypress", disableKeyPress, true);
				window.removeEventListener("blur", pauseFn, true);
				window.removeEventListener("focus", resumeFn, true);
				listening = false;
			}
		};

		/**
		 * Private methods below
		 */

		// Map a keyboard event to a direction. Arrow keys and WASD are supported,
		// by event.key first and by the legacy keyCode as a fallback.
		var directionForEvent = function(event){
			if (event.ctrlKey || event.metaKey || event.altKey)
				return null;
			switch (event.key) {
			case "ArrowLeft": case "a": case "A":
				return constants.DIRECTION_LEFT;
			case "ArrowUp": case "w": case "W":
				return constants.DIRECTION_UP;
			case "ArrowRight": case "d": case "D":
				return constants.DIRECTION_RIGHT;
			case "ArrowDown": case "s": case "S":
				return constants.DIRECTION_DOWN;
			}
			switch (event.keyCode) {
			case 37: case 65:
				return constants.DIRECTION_LEFT;
			case 38: case 87:
				return constants.DIRECTION_UP;
			case 39: case 68:
				return constants.DIRECTION_RIGHT;
			case 40: case 83:
				return constants.DIRECTION_DOWN;
			}
			return null;
		};

		var handleKeyDown = function(event){
			// If the key pressed is an arrow key or a WASD key
			if (directionForEvent(event) !== null) {
				handleArrowKeyPress(event);
			}
		};

		var disableKeyPress = function(event){
			// If the key pressed is an arrow key
			if (arrowKeys.indexOf(event.keyCode) >= 0) {
				event.preventDefault();
			}
		};

		var handleArrowKeyPress = function(event){
			lastDirection = directionForEvent(event);
			// Arrow keys usually makes the browser window scroll. Prevent this evil behavior
			event.preventDefault();
			// Call the auto play function
			autoPlayFn();
		};
	}

	if (config.autoInit) {
		this.init();
	}
};
