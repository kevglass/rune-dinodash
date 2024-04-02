import { graphics, sound } from "toglib";
import { ASSETS } from "./lib/assets";
import { GameEventType, GameState, GameUpdate, Item, Player, SLOW_DOWN } from "./logic";

export interface PlayerSprite {
    run: graphics.TileSet;
    idle: graphics.TileSet;
    runFrames: number;
    idleFrames: number;
}

export interface Piece {
    item: Item;
    xp: number;
    vy: number;
    y: number;
}

export interface Particle {
    life: number;
    x: number;
    y: number;
}

export class DinoDash implements graphics.Game {
    /** A white circle that lets us draw dots quickly */
    whiteCircle: graphics.GameImage;
    /** The smaller font used for most text */
    foot: graphics.GameImage;
    jump: graphics.GameImage;
    arrowOn: graphics.GameImage;
    arrowOff: graphics.GameImage;
    font: graphics.GameFont;
    bigFont: graphics.GameFont;
    flying: graphics.GameImage[];
    logo: graphics.GameImage;

    button: graphics.TileSet;
    layers: graphics.GameImage[] = [];
    tileset: graphics.TileSet;
    players: PlayerSprite[] = [];

    frameCount = 0;
    speed = 0;
    game?: GameState;
    player?: Player;
    spectator = false;

    leftFoot = false;

    lastSend = 0;
    lastSpeed = 0;
    lastPress = 0;

    canBounceBack = true;

    brokenPieces: Piece[] = [];
    waitingForReady = true;

    sfxEnd: sound.Sound;
    sfxJump: sound.Sound;
    sfxStartup: sound.Sound;
    sfxReady: sound.Sound;
    sfxStart: sound.Sound;
    sfxBump: sound.Sound;
    sfxFall: sound.Sound;
    sfxWin: sound.Sound;

    gameOver = false;
    dust: graphics.TileSet;

    particles: Particle[] = [];
    updateCount = 0;
    lastParticle = 0;
    watching = 0;

    constructor() {
        // we're going to use the WebGL renderer with 5 pixels of texture padding
        // to prevent artifacts 
        graphics.init(graphics.RendererType.WEBGL, true, undefined, 5);

        this.sfxEnd = sound.loadSound(ASSETS["end.mp3"]);
        this.sfxJump = sound.loadSound(ASSETS["jump.mp3"]);
        this.sfxStartup = sound.loadSound(ASSETS["startup.mp3"]);
        this.sfxReady = sound.loadSound(ASSETS["ready.mp3"]);
        this.sfxStart = sound.loadSound(ASSETS["start.mp3"]);
        this.sfxBump = sound.loadSound(ASSETS["bump.mp3"]);
        this.sfxFall = sound.loadSound(ASSETS["fall.mp3"]);
        this.sfxWin = sound.loadSound(ASSETS["win.mp3"]);

        this.whiteCircle = graphics.loadImage(ASSETS["whitecircle.png"]);
        this.foot = graphics.loadImage(ASSETS["foot.png"]);
        this.jump = graphics.loadImage(ASSETS["jump.png"]);
        this.logo = graphics.loadImage(ASSETS["logo.png"]);

        this.arrowOn = graphics.loadImage(ASSETS["arrow-on.png"]);
        this.arrowOff = graphics.loadImage(ASSETS["arrow-off.png"]);
        this.layers.push(graphics.loadImage(ASSETS["layer1.png"]));
        this.layers.push(graphics.loadImage(ASSETS["layer2.png"]));
        this.layers.push(graphics.loadImage(ASSETS["layer3.png"]));
        this.tileset = graphics.loadTileSet(ASSETS["tileset.png"], 16, 16);
        this.button = graphics.loadTileSet(ASSETS["button.png"], 8, 8);
        this.font = graphics.generateFont(16, "white");
        this.bigFont = graphics.generateFont(35, "white");

        this.dust = graphics.loadTileSet(ASSETS["dust.png"], 16, 16),
            this.flying = [];
        for (let i = 1; i < 5; i++) {
            this.flying.push(graphics.loadImage(ASSETS["flying/" + i + ".png"]))
        }
        this.players[0] = {
            run: graphics.loadTileSet(ASSETS["player1/run.png"], 32, 16),
            idle: graphics.loadTileSet(ASSETS["player1/idle.png"], 32, 16),
            runFrames: 6,
            idleFrames: 4
        }
        this.players[1] = {
            run: graphics.loadTileSet(ASSETS["player2/run.png"], 32, 32),
            idle: graphics.loadTileSet(ASSETS["player2/idle.png"], 32, 32),
            runFrames: 4,
            idleFrames: 4
        }
        this.players[2] = {
            run: graphics.loadTileSet(ASSETS["player3/run.png"], 32, 32),
            idle: graphics.loadTileSet(ASSETS["player3/idle.png"], 32, 32),
            runFrames: 4,
            idleFrames: 4
        }
        this.players[3] = {
            run: graphics.loadTileSet(ASSETS["player4/run.png"], 32, 32),
            idle: graphics.loadTileSet(ASSETS["player4/idle.png"], 32, 32),
            runFrames: 6,
            idleFrames: 4
        }
        this.font = graphics.generateFont(16, "white");
    }

    mouseDown(x: number, y: number): void {
        if (this.spectator) {

            const buttonScale = graphics.width() / 18;
            x -= 10;
            x /= buttonScale * 4.5;
            x = Math.floor(x);
            if (x >= 0 && x < 4) {
                this.watching = x;
            }
            return;
        }
        if (this.waitingForReady) {
            if (Math.abs(y - graphics.height() / 2) < 50) {
                Rune.actions.ready();
                sound.playSound(this.sfxReady);
            }
            return;
        }
        if (this.waitingForStart()) {
            return;
        }

        if (this.game) {
            if (y > graphics.height() / 2) {
                if (x < graphics.width() * 0.25) {
                    // left foot
                    if (this.leftFoot) {
                        this.speed += 1;
                        this.leftFoot = false;
                        this.lastPress = Date.now();
                    }
                } else if (x > graphics.width() * 0.75) {
                    // right foot
                    if (!this.leftFoot) {
                        this.speed += 1;
                        this.leftFoot = true;
                        this.lastPress = Date.now();
                    }
                } else {
                    // jump
                    Rune.actions.jump();
                    sound.playSound(this.sfxJump);
                }
            }
        }
    }

    mouseDrag(): void {
        // do nothing
    }

    mouseUp(): void {
        // do nothing
    }

    keyDown(key: string): void {
        if (this.spectator) {
            return;
        }
        if (this.waitingForStart()) {
            return;
        }

        if (key === 'a') {
            if (this.leftFoot) {
                this.speed += 1;
                this.leftFoot = false;
                this.lastPress = Date.now();
            }
        }
        if (key === 'l') {
            if (!this.leftFoot) {
                this.speed += 1;
                this.leftFoot = true;
                this.lastPress = Date.now();
            }
        }

        if (key === ' ') {
            Rune.actions.jump();
            sound.playSound(this.sfxJump);
        }
    }

    keyUp(): void {
        // do nothing
    }

    waitingForStart(): boolean {
        return !!this.game && this.game.gameStart > Rune.gameTime();
    }

    gameUpdate(update: GameUpdate): void {
        if (update.event?.name !== "update") {
            return;
        }

        for (const particle of [...this.particles]) {
            particle.life++;
            if (particle.life > 15) {
                this.particles.splice(this.particles.indexOf(particle), 1);
            }
        }

        this.game = update.game;
        if (!this.gameOver && this.game.gameOver) {
            this.gameOver = true;
            const players = Object.values(this.game.players);
            const winner = players.reduce((a, b) => a.x > b.x ? a : b);
            if (winner.id === update.yourPlayerId) {
                sound.playSound(this.sfxWin, 0.5);
            } else {
                sound.playSound(this.sfxEnd, 0.5);
            }
        }
        if (this.game.restart) {
            this.waitingForReady = true;
            this.speed = 0;
            this.gameOver = false;
            sound.playSound(this.sfxStartup);
        }

        if (this.game.gameStart !== 0 && this.waitingForReady) {
            this.waitingForReady = false;
            sound.playSound(this.sfxStart);
        }
        if (update.yourPlayerId && update.game.players[update.yourPlayerId]) {
            this.player = update.game.players[update.yourPlayerId];
            this.spectator = false;
        } else {
            this.player = Object.values(update.game.players)[this.watching];
            this.spectator = true;
        }

        for (const event of this.game.events) {
            this.brokenPieces.push({ ...event, vy: -20, y: 0 });

            if (event.playerId === update.yourPlayerId && event.type === GameEventType.HIT) {
                this.speed = -20;
                sound.playSound(this.sfxBump);
            }
            if (event.playerId === update.yourPlayerId && event.type === GameEventType.DIED) {
                sound.playSound(this.sfxFall);
                this.speed = 0;
            }
        }
        if (this.player && !this.spectator) {
            if (this.speed > 0) {
                this.canBounceBack = true;
                this.speed *= SLOW_DOWN;
                if (this.speed < 0.1 && Date.now() - this.lastPress > 1000) {
                    this.speed = 0;
                }
            } else if (this.speed < 0) {
                this.speed *= 0.75;
            }
        }

        for (const piece of [...this.brokenPieces]) {
            piece.vy += 1;
            piece.y += piece.vy;
            if (piece.y > 128) {
                this.brokenPieces.splice(this.brokenPieces.indexOf(piece), 1);
            }
        }
        if (Date.now() - this.lastParticle > 500) {
            this.lastParticle = Date.now();

            for (const player of Object.values(this.game.players)) {
                if (player.vx > 1 && player.y === 0) {
                    this.particles.push({ life: 0, x: player.x - 25, y: player.y });
                }
            }
        }
    }

    start(): void {
        // kick off the TOGL rendering loop
        graphics.startRendering(this);
    }

    resourcesLoaded(): void {
        // initialise the Rune SDK and register the callback to get
        // game updates
        Rune.initClient({
            onChange: (update) => {
                this.gameUpdate(update);
            },
        });
    }

    send(): void {
        if (this.spectator) {
            return;
        }

        // send updates 5 times a second
        if (Date.now() - this.lastSend > 1000 / 5) {
            if (this.lastSpeed !== this.speed) {
                this.lastSpeed = this.speed;
                this.lastSend = Date.now();
                Rune.actions.speed({ speed: this.speed });
            }
        }
    }

    render(): void {
        if (!this.game || !this.player) {
            return;
        }

        this.send();

        this.frameCount++;
        // do nothing
        graphics.fillRect(0, 0, graphics.width(), graphics.height(), "rgb(201,236,255)");

        const y = Math.floor((graphics.height() / 1.8));
        const bgWidth = Math.floor(graphics.width() * 1.5);
        for (let i = 0; i < this.layers.length; i++) {
            graphics.push();
            graphics.translate((-(this.player.x * (0.25 * i)) % bgWidth), 0);
            for (let n = 0; n < 2; n++) {
                graphics.translate((n * bgWidth), 0);
                const layer = this.layers[i];
                const layerHeight = Math.floor((bgWidth / layer.width) * layer.height);
                graphics.drawImage(layer, 0, y - layerHeight, bgWidth, layerHeight);
            }
            graphics.pop();
        }
        graphics.fillRect(0, y, graphics.width(), graphics.height() - y, "rgb(184,75,72)");

        graphics.push();
        graphics.translate(((-this.player.x) % 32) - 32, 0);
        const base = Math.floor(this.player.x / 32) - 2;
        for (let i = 0; i < 50; i++) {
            const xp = i + base;

            let offset = 0;

            if (this.game.items[xp] === Item.GAP || this.game.items[xp + 1] === Item.GAP) {
                continue;
            }
            if (this.game.items[xp] === Item.GAP2 || this.game.items[xp + 1] === Item.GAP2 || this.game.items[xp + 2] === Item.GAP2) {
                continue;
            }
            if (this.game.items[xp - 1] === Item.GAP) {
                offset = -1;
            }
            if (this.game.items[xp + 2] === Item.GAP) {
                offset = 1;
            }
            if (this.game.items[xp - 1] === Item.GAP2) {
                offset = -1;
            }
            if (this.game.items[xp + 3] === Item.GAP2) {
                offset = 1;
            }
            graphics.drawTile(this.tileset, i * 32, y, 11 + offset, 32, 32);
            graphics.drawTile(this.tileset, i * 32, y + 32, 21 + offset, 32, 32);
            graphics.drawTile(this.tileset, i * 32, y + 64, 31 + offset, 32, 32);

            if (this.game.items[xp] === Item.SMALL_CACTUS) {
                graphics.drawTile(this.tileset, i * 32, y - 32, 15, 32, 32);
            }
            if (this.game.items[xp] === Item.CACTUS) {
                graphics.drawTile(this.tileset, i * 32, y - 32, 14, 32, 32);
            }
            if (this.game.items[xp] === Item.ROCKS) {
                graphics.drawTile(this.tileset, i * 32, y - 32, 23, 32, 32);
            }
            if (this.game.items[xp] === Item.FLYING) {
                graphics.drawImage(this.flying[Math.floor(this.frameCount / 10) % 4], i * 32, y - 96, 64, 64);
            }
        }
        for (let i = 0; i < 50; i++) {
            const xp = i + base;

            const piece = this.brokenPieces.find(piece => piece.xp === xp);
            if (piece) {
                if (piece.item === Item.SMALL_CACTUS) {
                    graphics.drawTile(this.tileset, i * 32, y - 32 + piece.y, 15, 32, 32);
                }
                if (piece.item === Item.CACTUS) {
                    graphics.drawTile(this.tileset, i * 32, y - 32 + piece.y, 14, 32, 32);
                }
                if (piece.item === Item.ROCKS) {
                    graphics.drawTile(this.tileset, i * 32, y - 32 + piece.y, 23, 32, 32);
                }
                if (piece.item === Item.FLYING) {
                    graphics.drawImage(this.flying[Math.floor(this.frameCount / 10) % 4], i * 32, y - 96 + piece.y, 64, 64);
                }
            }
        }
        graphics.pop();

        graphics.push();
        graphics.translate(-Math.floor(this.player.x) + 30, 0);

        const players = Object.values(this.game.players);
        players.splice(players.indexOf(this.player), 1);
        players.push(this.player);

        if (!this.waitingForReady) {
            for (const particle of this.particles) {
                graphics.push();
                graphics.translate(Math.floor(particle.x), y + Math.floor(particle.y));
                graphics.drawTile(this.dust, 0, -32, Math.floor(particle.life / 3), 32, 32);
                graphics.pop();
            }
            for (const dino of players) {
                if (dino.y > 120) {
                    continue;
                }
                const playerSprite = this.players[dino.sprite];
                const anim = dino.vx < 1 ? playerSprite.idle : playerSprite.run;
                const frames = dino.vx < 1 ? playerSprite.idleFrames : playerSprite.runFrames;
                graphics.push();
                graphics.translate(Math.floor(dino.x), y + Math.floor(dino.y) - (playerSprite.run.tileHeight * 2));
                graphics.drawTile(anim, -32, 0, Math.floor(this.frameCount / (12 - frames)) % frames, anim.tileWidth * 2, anim.tileHeight * 2, dino === this.player ? "white" : "#aaa");
                graphics.pop();
            }
        }
        graphics.pop();

        if (!this.spectator) {
            const buttonScale = graphics.width() / 14;

            const leftArrow = this.leftFoot ? this.arrowOn : this.arrowOff;
            const rightArrow = this.leftFoot ? this.arrowOff : this.arrowOn;

            graphics.drawImage(leftArrow, 8 + (buttonScale * 1.5) - (leftArrow.width / 2),
                graphics.height() - (buttonScale * 5) - leftArrow.height);
            graphics.ninePatch(this.button, 8, graphics.height() - (buttonScale * 5), buttonScale * 3, buttonScale * 3, "#8ba9d4");
            graphics.drawImage(this.foot, 8 + (buttonScale * 0.25), graphics.height() - (buttonScale * 4.75), buttonScale * 2.5, buttonScale * 2.5);

            graphics.drawImage(rightArrow, graphics.width() - 8 - (buttonScale * 3) + (buttonScale * 1.5) - (rightArrow.width / 2),
                graphics.height() - (buttonScale * 5) - rightArrow.height);
            graphics.ninePatch(this.button, graphics.width() - 8 - (buttonScale * 3), graphics.height() - (buttonScale * 5), buttonScale * 3, buttonScale * 3, "#8ba9d4");
            graphics.drawImage(this.foot, graphics.width() - 8 - (buttonScale * 3) + (buttonScale * 0.25), graphics.height() - (buttonScale * 4.75), buttonScale * 2.5, buttonScale * 2.5);

            graphics.ninePatch(this.button, (buttonScale * 4), graphics.height() - (buttonScale * 4), graphics.width() - (buttonScale * 8), buttonScale * 2, "#a6cc34");
            graphics.drawImage(this.jump, Math.floor(graphics.width() / 2) - (buttonScale * 0.75), graphics.height() - (buttonScale * 3.75), buttonScale * 1.5, buttonScale * 1.5);
        } else {
            let index = 0;
            const buttonScale = graphics.width() / 18;
            for (const player of Object.values(this.game.players)) {
                graphics.ninePatch(this.button, 10 + (index * buttonScale * 4.5), graphics.height() - (buttonScale * 4.5), buttonScale * 4, buttonScale * 4, this.watching == index ?  "#a6cc34" : "#8ba9d4");
                const playerSprite = this.players[player.sprite];
                const anim = playerSprite.idle;
                graphics.drawTile(playerSprite.idle, (index * buttonScale * 4.5) + (buttonScale * 2) - 22, graphics.height() - (buttonScale * 1) - (anim.tileHeight * 2), 0, anim.tileWidth * 2, anim.tileHeight * 2);
                index++;
            }

        }
        if (!this.game.gameOver) {
            graphics.fillRect(0, 0, graphics.width(), 28, "rgba(0,0,0,0.5)");
            const width = Math.floor(graphics.width() / 4);
            graphics.fillRect(Math.floor((graphics.width() / 2) - (width / 2)) - 1, 4, width + 2, 20, "black");
            if (this.speed >= 0) {
                graphics.fillRect(Math.floor((graphics.width() / 2) - (width / 2)), 5, Math.min(width, Math.floor((this.speed / 30) * width)), 18, "#748db1");
            }

            const distance = Math.floor((this.player.x - 60) / 50) + "m";
            graphics.drawText(6, 21, distance, this.font, "black");
            graphics.drawText(5, 20, distance, this.font);

            const secondsRemaining = Math.floor((this.game.endGame - Rune.gameTime()) / 1000);
            const secs = Math.max(0, secondsRemaining % 60);
            const mins = Math.max(Math.floor(secondsRemaining / 60));
            const secsStr = secs < 10 ? "0" + secs : "" + secs;
            const minsStr = mins < 10 ? "0" + mins : "" + mins;
            const timeStr = minsStr + ":" + secsStr;

            graphics.drawText(graphics.width() - graphics.textWidth(timeStr, this.font) - 10, 21, timeStr, this.font, "black");
            graphics.drawText(graphics.width() - graphics.textWidth(timeStr, this.font) - 9, 20, timeStr, this.font, "white");
        }

        if (this.waitingForReady && !this.spectator) {
            graphics.fillRect(0, 0, graphics.width(), graphics.height(), "rgba(0,0,0,0.25)");
            graphics.drawImage(this.logo, Math.floor((graphics.width() - this.logo.width) / 2), 50);

            const playerSprite = this.players[this.player.sprite];
            const anim = this.player.vx < 1 ? playerSprite.idle : playerSprite.run;
            const frames = this.player.vx < 1 ? playerSprite.idleFrames : playerSprite.runFrames;
            graphics.drawTile(anim, (graphics.width() / 2) - 48, (graphics.height() / 2) - 10 - anim.tileHeight * 3, Math.floor(this.frameCount / (12 - frames)) % frames, anim.tileWidth * 3, anim.tileHeight * 3);

            if (this.player.ready) {
                const msg = "Waiting...";
                graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2) + 2, Math.floor(graphics.height() / 2) + 40, msg, this.bigFont, "black");
                graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2), Math.floor(graphics.height() / 2) + 38, msg, this.bigFont);

            } else {
                graphics.fillRect(Math.floor(graphics.width() / 2) - 100, Math.floor(graphics.height() / 2), 204, 54, "rgba(0,0,0,0.5)");
                graphics.fillRect(Math.floor(graphics.width() / 2) - 102, Math.floor(graphics.height() / 2) - 2, 204, 54, "black");
                graphics.fillRect(Math.floor(graphics.width() / 2) - 100, Math.floor(graphics.height() / 2), 200, 50, "#a6cc34");

                const msg = "Ready?";
                graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2), Math.floor(graphics.height() / 2) + 38, msg, this.bigFont);
            }
        }

        const untilStart = this.game.gameStart - Rune.gameTime()
        if (this.waitingForStart()) {
            if (untilStart > 2000) {
                const msg = "Ready?";
                graphics.fillRect(0, Math.floor(graphics.height() / 2) - 80, graphics.width(), 50, "rgba(0,0,0,0.5)");
                graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2) + 2, Math.floor(graphics.height() / 2) - 40, msg, this.bigFont, "black");
                graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2), Math.floor(graphics.height() / 2) - 42, msg, this.bigFont, "#ad443d");
            } else if (untilStart > 1000) {
                const msg = "Get Set!";
                graphics.fillRect(0, Math.floor(graphics.height() / 2) - 80, graphics.width(), 50, "rgba(0,0,0,0.5)");
                graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2) + 2, Math.floor(graphics.height() / 2) - 40, msg, this.bigFont, "black");
                graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2), Math.floor(graphics.height() / 2) - 42, msg, this.bigFont, "#df6d38");
            } else if (untilStart > 0) {
                const msg = "Go!";
                graphics.fillRect(0, Math.floor(graphics.height() / 2) - 80, graphics.width(), 50, "rgba(0,0,0,0.5)");
                graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2) + 2, Math.floor(graphics.height() / 2) - 40, msg, this.bigFont, "black");
                graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2), Math.floor(graphics.height() / 2) - 42, msg, this.bigFont, "#a6cc34");
            }
        }

        if (this.game.gameOver) {
            const msg = "Winner!";

            graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2) + 2, 42, msg, this.bigFont, "black");
            graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2), 40, msg, this.bigFont, "white");

            const players = Object.values(this.game.players);
            const winner = players.reduce((a, b) => a.x > b.x ? a : b);
            graphics.fillRect(0, 55, graphics.width(), 25, "rgba(0,0,0,0.5)");
            const winnerInfo = Rune.getPlayerInfo(winner.id);
            if (winnerInfo) {
                graphics.drawText(58, 73, winnerInfo.displayName, this.font);
            }
            const distance = Math.floor((winner.x - 60) / 50) + "m";
            graphics.drawText(graphics.width() - 10 - graphics.textWidth(distance, this.font), 75, distance, this.font);
            const playerSprite = this.players[winner.sprite];
            const anim = playerSprite.idle;
            graphics.drawTile(anim, -10, 82 - anim.tileHeight * 2, 0, anim.tileWidth * 2, anim.tileHeight * 2);

            graphics.push();
            graphics.translate(0, 64);
            for (const player of players) {
                if (player === winner) {
                    continue;
                }

                graphics.fillRect(0, 55, graphics.width(), 25, "rgba(0,0,0,0.5)");
                const playerInfo = Rune.getPlayerInfo(player.id);
                if (playerInfo) {
                    graphics.drawText(58, 73, Rune.getPlayerInfo(player.id).displayName, this.font);
                }
                const distance = Math.floor((player.x - 60) / 50) + "m";
                graphics.drawText(graphics.width() - 10 - graphics.textWidth(distance, this.font), 75, distance, this.font);
                const playerSprite = this.players[player.sprite];
                const anim = playerSprite.idle;
                graphics.drawTile(anim, -10, 82 - anim.tileHeight * 2, 0, anim.tileWidth * 2, anim.tileHeight * 2);
                graphics.translate(0, 32);
            }
            graphics.pop();
        }
    }
}