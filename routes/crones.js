let express = require('express'),
    router = express.Router(),
    cronehandler = require('../handlers/croneHandler'),
    functions = require('../helpers/functions');

/* GET users listing. */
router.get('/', cronehandler.index);

router.get('/stop_bid', cronehandler.stop_bid);
router.get('/draw_meeting', cronehandler.draw_meeting);


module.exports = router;