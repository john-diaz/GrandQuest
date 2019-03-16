/* ./packages/socketServer/events/shops.js */

const store = require('../../engine/store');
const pool = require('../../services/psql/pool');

const availableShops = {
	'potions-shop': {
		location: 'monokai-village',
		items: {
			'heal-potion': 11,
		},
		actions: {
			'heal': (player) => new Promise((resolve, reject) => {
				pool.query(`SELECT * FROM combatants WHERE id = ${player.id}`, (err, results) => {
					if (err) {
						return reject('Failed to heal player. Please try again later!');
					}

					const combatant = results.rows[0];

					const gold = player.gold;
					const health = combatant.health;
					const maxHealth = combatant.max_health;

					if (health === maxHealth) {
						return reject('Great news, your health is already maxed out!');
					}
					// how much HP you can buy with ONE gold
					const goldToHealthUnit = 3;

					/* ----- */

					// the amount of HP affordable with user's gold
					let affordableHP = gold * goldToHealthUnit;

					if (affordableHP < 1) {
						reject('Sorry, your gold is too low to afford healing.');
					} else {
						let added = Math.min(health + affordableHP, maxHealth) - health;
						let cost = Number((added / goldToHealthUnit).toFixed(1));

						pool.query(`
							WITH u AS (
			          UPDATE users
			          SET gold = gold - ${cost}
			          WHERE id = ${player.id}
			          RETURNING id
			        )
			        UPDATE combatants
			        SET health = health + ${added}
			        WHERE id = ${player.id}
						`).then((results) => {
							store.update('players', (players) => ({
								...players,
								[player.id]: {
									...player,
									gold: gold - cost,
								}
							}));
							resolve({
								before: health,
								after: health + added,
								max: maxHealth,
								cost: cost,
							});
						});
					}
				});
			}),
		}
	}
}

module.exports = (namespace) => (socket) => {
	socket.on('SHOP_TRANSACTION', (transaction, cb) => {
		// type checking
		if (!transaction || typeof transaction !== 'object') {
			if (typeof cb === 'function') cb('An invalid transaction was provided.');
			return;
		}
		const player = store.getState().players[socket.userID];
		if (!socket.userID || !player) {
			if (typeof cb === 'function') cb('You don\'t appear to be authenticated.');
			return;	
		}

		const chosenShop = availableShops[transaction.shop];
		if (!chosenShop) {
			if (typeof cb === 'function') cb('Invalid shop provided. Please try again later.');
			return;
		}

		/*
			if chosenShop.location !== player.location
				return
		*/

		const item = typeof transaction.item === 'string' && transaction.item.trim().length > 0
			? transaction.item.trim().toLowerCase()
			: false;
		const action = typeof transaction.action === 'string' && transaction.action.trim().length > 0
			? transaction.action.trim().toLowerCase()
			: false;
		const shop = typeof transaction.shop === 'string' && transaction.shop.trim().length > 0
			? transaction.shop.trim().toLowerCase()
			: false;

		if (item) {
			if (!chosenShop.items.hasOwnProperty(item)) {
				if (typeof cb === 'function') cb('Sorry, we dont sell that right now.');
				return;
			}

			const itemPrice = chosenShop.items[item];

			if (player.gold < itemPrice) {
				if (typeof cb === 'function') cb('It looks like you don\'t have enough money for that item.');
				return;
			}

			const newGold = Math.max(player.gold - itemPrice, 0);
			pool.query(`
				INSERT INTO user_inventory (
					user_id,
					item_id
				) VALUES (
					$1, $2
				);
			`, [player.id, item], err => {
				if (err) throw err;
			});
			pool.query(`UPDATE users SET gold = ${newGold}`, (err) => {
				if (err) throw err;
			});
			store.update('players', (players) => ({
				...players,
				[player.id]: {
					...player,
					gold: newGold,
				}
			}));

			if (typeof cb === 'function') cb(null);
		} else if (action) {
			if (!chosenShop.actions.hasOwnProperty(action)) {
				if (typeof cb === 'function') cb('Sorry, I\'m not sure I can do that right now.');
				return;
			}

			chosenShop.actions[action](player)
			.then((results) => {
				if (typeof cb === 'function') {
					cb(null, results);
				}
			})
			.catch((err) => {
				cb(err);
			});
		} else {
			if (typeof cb === 'function') cb('Conflicting transaction provided - select either an action OR item.');
			return;
		}
		if (!item && !action) {
			if (typeof cb === 'function') cb('There was a problem with your transaction. Please try again later.');
			return;
		}
	});
}