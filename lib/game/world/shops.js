/* ./lib/game/shops.js */

const async = require('async');
const store = require('../store');

const items = require('../definitions/items');
const availableShops = {
	'potions-shop': {
		location: 'monokai-village',
		selling: {
			'heal-potion': 11,
		},
	}
}

module.exports = (namespace) => (socket) => {
	socket.on('ITEM_TRANSACTION', (transaction, cb) => {
		// type checking
		if (
			typeof transaction !== 'object' ||
			typeof transaction.item !== 'string' ||
			typeof transaction.shop !== 'string'
		) {
			if (typeof cb === 'function') cb('There was a problem with your transaction. Please try again later.');
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

		if (!chosenShop.selling.hasOwnProperty(transaction.item)) {
			if (typeof cb === 'function') cb('Sorry, we dont sell that right now.');
			return;
		}
		const itemPrice = chosenShop.selling[transaction.item];

		if (player.gold < itemPrice) {
			if (typeof cb === 'function') cb('It looks like you don\'t have enough money for that item.')
			return;
		}

		console.log('buying ', transaction.item);
		if (typeof cb === 'function') cb(null);
	});
}