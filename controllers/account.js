const User = require('../models/User');

const displayAccount = (knex) => async (req, res) => {
    const username = req.session.user
    let data = {
        notification: null,
        user: username
    };
    if (req.session.notification) {
        data.notification = req.session.notification;
        req.session.notification = null;
    }
    const userCourses = await User
        .query()
        .eager('courses')
        .modifyEager('courses', builder => {
            builder.groupBy('course_full_number');
        })
        .where({
            username: username
        })
        .then(result => {
            console.log(result[0])
            let coursesArray = result[0].courses.map(course => {
                return `(${course.course_full_number}) ${course.name}`;
            });
            data.courses = coursesArray;
        })
        .catch(err => {
            console.log(err.stack);
            data.notification = {
                type: 'error',
                message: 'Error retrieving account information. Something went wrong on our end :('
            };
        });
    res.render('pages/account', data);
}

module.exports = {
    displayAccount: displayAccount
}