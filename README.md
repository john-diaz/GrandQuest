# GrandQuest
A spin off the [Epiquest](https://github.com/JohnCdf/TheEpiquestRep)

# Current stage of development
Right now the upstream prerequisites are being worked.

## Technologies to be used
 React.js,
 Node.js/ MongoDB,
 GreenSock,
 frameworks*

## Architecture
### Design
Ideally Navigation will be handled by React-router. GreenSock will be used for animations involving the map, and maybe scrolling.
The user will require and account to play, and will possess an inventory, avatar, and level.
Ideally, the players will be able to add each other, but there will be no chat.
I will take responsibility over the visual aesthetic, interfaces, logo, etc. in case there no others can.

### Narrative Design
The user will have to level up by completing tasks, travelling, and combatting. Ideally, a PvP could be implemented.

### Locations
The world will be constructed in the following manner:
Country -> Capital -> Town -> [...location]
One of the routes will render a map of your current town / location in it. To change capitals, you would have to level up. Once you unlock enough capitals, travelling to diferent countries would be enabled.

#### Map Data Structure
The data structure for the world should ideally branch from the world, to country, etc. in a tree model. The map interface image source will be contained in the data of the current location.

#### Navigating the map
The map is held inside a wrapper with a fixed size.
The actual map position will be manipulated with css.
[example]('https://github.com/JohnCdf/GrandQuest/blob/master/example.html')
To go to a location, the user will need to click on the position of the location.
The current location search function will check if there is a spot in the range of the coordinates in the mouse click (see example).
