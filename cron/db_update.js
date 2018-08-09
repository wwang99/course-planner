const cron = require("node-cron");
const fs = require("fs");
const fetch = require('node-fetch');
const knexfile = require('../knexfile.js');
const Knex = require('knex');
const knexConfig = require('../knexfile');
const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);
const { Model } = require('objection');


const Course = require('../models/Course.js');

//initalize knex (won't need this later on)
const knex = Knex(knexConfig);

Model.knex(knex);

// returns an array of subject codes
const getSubjectCodes = async () => {
    try {
        const response = await fetch('https://sis.rutgers.edu/soc/subjects.json?semester=92018&campus=NB&level=U');
        const subjects = await response.json();
        let subjectCodes = [];
        for (subject of subjects) {
            subjectCodes.push(subject.code);
        }
        return subjectCodes;
    } catch (error) {
        console.log('subject code error');
        console.log(error);
        throw('there was an error retrieving subject codes');
    } 
}

// gets the course data from rutgers api
const getCourseData = async (subjectCode) => {
    try {
        const response = await fetch(`https://sis.rutgers.edu/soc/courses.json?subject=${subjectCode}&semester=92018&campus=NB&level=U`);
        const courseData = await response.json();
        // console.log(courseData);
        return courseData;
    } catch (error) {
        console.log('course data error');
        console.log(error);
        throw('there was an error retrieving course data');
    }
}

// updates the entire db (should only be done once a semester)
const updateAllCoursesData = async () => {
    try {
        knex.schema.dropTableIfExists('courses')
        subjectCodes = await getSubjectCodes();
        let courseSections = [];
        for(subjectCode of subjectCodes) {
            // includes all sections and courses in a subject
            let courses = await getCourseData(subjectCode);
            // iterates through all the courses
            for (course of courses) {
                let { offeringUnitCode: courseUnitCode,
                     subject: courseSubject,
                     courseNumber,
                     title,
                     sections: courseSections,
                     campusCode: courseCampus,
                     synopsisUrl: courseUrl,
                     preReqNotes: coursePreReqs,
                    } = course;
                let courseFullNum = courseUnitCode + ':' + courseSubject + ':' + courseNumber;
                let courseShortTitle = courses.toString().trim().replace("'", "");
                let courseCredits = 0;
                if (course.courseCredits != null) {
                    courseCredits = course.credits;
                }
                let courseCoreCodes = JSON.stringify({});
                if (courses.coreCodes != null) {
                    courseCoreCodes = JSON.stringify(courses.coreCodes);
                }
                for (section of courseSections) {
                    let { 
                        number: sectionNum,
                        index: sectionIndex,
                        sectionNotes,
                        examCode: sectionExamCode
                    } = section;
                    let sectionOpenStatus = 'CLOSED';
                    if (section.openStatus) {
                        sectionOpenStatus = 'OPEN';
                    }
                    
                    let section_instructors = null;
                    for (instructor of section.instructors) {
                        if (section_instructors != null) {
                            section_instructors += " and " + instructor.name;
                        } else {
                            section_instructors = instructor.name;
                        }
                    }
                    if (section_instructors != null) {
                        section_instructors = section_instructors.replace("'", "");
                    }
                    
                    let sectionTimes = JSON.stringify(section.meetingTimes);
                    if (sectionNotes != null) {
                        sectionNotes = sectionNotes.replace("'", "");
                    }
                    let lastUpdatedTime = new Date().toLocaleString("en-US");
                    
                    const insertedSection = await Course.query().insert({
                        course_unit: courseUnitCode,
                        course_subject: courseSubject,
                        course_number: courseNumber,
                        course_full_number: courseFullNum,
                        name: courseShortTitle,
                        section_number: sectionNum,
                        section_index: sectionIndex,
                        section_open_status: sectionOpenStatus,
                        instructors: section_instructors,
                        times: sectionTimes,
                        notes: sectionNotes,
                        exam_code: sectionExamCode,
                        campus: courseCampus,
                        credits: courseCredits,
                        url: courseUrl,
                        pre_reqs: coursePreReqs,
                        core_code: courseCoreCodes,
                        last_updated: lastUpdatedTime
                    });
                }
            }
        }
        console.log('test');
        console.log(courseSections);
    } catch (error) {
        console.log('there was an error updating the db');
        console.log(error);
    }

}

// updates the openStatus in course table every 1-2 minutes
const updateCourseOpenStatus = async () => {
    cron.schedule('* * * * * *', () => {
        console.log('running a task every second');
    });
}

updateAllCoursesData();

module.exports = { updateCourseOpenStatus: updateCourseOpenStatus }