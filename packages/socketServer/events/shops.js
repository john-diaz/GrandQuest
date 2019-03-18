/* ./packages/socketServer/events/shops.js */

const store = require('../../engine/store');
const pool = require('../../services/psql/pool');

const { powerDefenseCosts } = require('../../data/costs');

const availableShops = {
	'potions-shop': {
		location: 'monokai-village',
		items: {
			'heal-potion': 8,
			'heal-potion-2': 24,
		},
		actions: {
			'heal': (user) => new Promise((resolve, reject) => {
				pool.query(`SELECT * FROM combatants WHERE id = ${user.id}`, (err, results) => {
					if (err) {
						return reject('Failed to heal user. Please try again later!');
					}

					const combatant = results.rows[0];

					const gold = user.gold;
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
						const newGold = Math.ceil(gold - cost);

						pool.query(`
							WITH u AS (
			          UPDATE users
			          SET gold = ${newGold}
			          WHERE id = ${user.id}
			          RETURNING id
			        )
			        UPDATE combatants
			        SET health = health + ${added}
			        WHERE id = ${user.id}
						`).then((results) => {
							store.update('users', (users) => ({
								...users,
								[user.id]: {
									...user,
									gold: newGold,
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
	},
	'combat-shop': {
		location: 'monokai-village',
		items: {},
		actions: {
			'power-up': (user) => new Promise((resolve, reject) => {
				pool.query(`SELECT * FROM combatants WHERE id = ${user.id}`, (err, results) => {
					if (err) {
						reject('Something went wrong while working on your upgrade. Please try again later');
					} else {
						const combatant = results.rows[0];
						const currentPower = combatant.power;
						const nextPower = currentPower + 1;

						if (!powerDefenseCosts.hasOwnProperty(nextPower)) {
							return reject('Theres not much I can do for your power right now. Come back later.');
						}
						const cost = powerDefenseCosts[nextPower];

						if (user.gold < cost) {
							return reject('You dont have enough gold to afford this upgrade. Come back later.');
						}

						const newGold = Math.round(user.gold - cost);

						pool.query(`
							WITH u AS (
			          UPDATE users
			          SET gold = ${newGold}
			          WHERE id = ${user.id}
			          RETURNING id
			        )
			        UPDATE combatants
			        SET power = power + 1
			        WHERE id = ${user.id}
						`, (err, results) => {
							if (err) {
								return reject('Something went wrong while upgrading defense. Please try again later');
							}
							store.update('users', (users) => ({
								...users,
								[user.id]: {
									...user,
									gold: newGold,
								}
							}));
							resolve({
								before: currentPower,
								after: nextPower,
								cost: cost,
							});
						});
					}
				});
			}),
			'defense-up': (user) => new Promise((resolve, reject) => {
				pool.query(`SELECT * FROM combatants WHERE id = ${user.id}`, (err, results) => {
					if (err) {
						reject('Something went wrong while working on your upgrade. Please try again later');
					} else {
						const combatant = results.rows[0];
						const currentDefense = combatant.defense;
						const nextDefense = currentDefense + 1;

						if (!powerDefenseCosts.hasOwnProperty(nextDefense)) {
							return reject('Theres not much I can do for your defense right now. Come back later.');
						}
						const cost = powerDefenseCosts[nextDefense];

						if (user.gold < cost) {
							return reject('You dont have enough gold to afford this upgrade. Come back later.');
						}

						const newGold = Math.round(user.gold - cost);

						pool.query(`
							WITH u AS (
			          UPDATE users
			          SET gold = ${newGold}
			          WHERE id = ${user.id}
			          RETURNING id
			        )
			        UPDATE combatants
			        SET defense = defense + 1
			        WHERE id = ${user.id}
						`, (err, results) => {
							if (err) {
								return reject('Something went wrong while upgrading defense. Please try again later');
							}

							store.update('users', (users) => ({
								...users,
								[user.id]: {
									...user,
									gold: newGold,
								}
							}));
							resolve({
								before: currentDefense,
								after: nextDefense,
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
		const user = store.getState().users[socket.userID];
		if (!socket.userID || !user) {
			if (typeof cb === 'function') cb('You don\'t appear to be authenticated.');
			return;	
		}

		const chosenShop = availableShops[transaction.shop];
		if (!chosenShop) {
			if (typeof cb === 'function') cb('Invalid shop provided. Please try again later.');
			return;
		}

		/*
			if chosenShop.location !== user.location
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

			if (user.gold < itemPrice) {
				if (typeof cb === 'function') cb('It looks like you don\'t have enough money for that item.');
				return;
			}

			const newGold = Math.max(user.gold - itemPrice, 0);
			pool.query(`
				INSERT INTO user_inventory (
					user_id,
					item_id
				) VALUES (
					$1, $2
				);
			`, [user.id, item], err => {
				if (err) throw err;
			});
			pool.query(`UPDATE users SET gold = ${newGold}`, (err) => {
				if (err) throw err;
			});
			store.update('users', (users) => ({
				...users,
				[user.id]: {
					...user,
					gold: newGold,
				}
			}));

			if (typeof cb === 'function') cb(null);
		} else if (action) {
			if (!chosenShop.actions.hasOwnProperty(action)) {
				if (typeof cb === 'function') cb('Sorry, I\'m not sure I can do that right now.');
				return;
			}

			chosenShop.actions[action](user)
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