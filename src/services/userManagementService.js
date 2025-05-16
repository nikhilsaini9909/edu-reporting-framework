const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

class UserManagementService {
    async createSchool(adminData) {
        try {
            const { email, password, schoolName, address, contactNumber } = adminData;

            // Create admin user in Supabase Auth
            const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                options: {
                    data: {
                        role: 'admin',
                        schoolName
                    }
                }
            });

            if (error) throw error;

            // Create admin role entry
            const { error: roleError } = await supabaseAdmin
                .from('user_roles')
                .insert([{
                    user_id: user.id,
                    role: 'admin',
                    is_active: true
                }]);

            if (roleError) throw roleError;

            // Create school profile
            const { data: schoolData, error: schoolError } = await supabaseAdmin
                .from('schools')
                .insert([{
                    admin_id: user.id,
                    name: schoolName,
                    address,
                    contact_number: contactNumber,
                    is_active: true
                }])
                .select()
                .single();

            if (schoolError) throw schoolError;

            return {
                message: 'School admin created successfully',
                user: {
                    id: user.id,
                    email: user.email,
                    role: 'admin',
                    schoolName
                },
                school: {
                    id: schoolData.id,
                    name: schoolData.name
                }
            };
        } catch (error) {
            logger.error('Create school error:', error);
            throw error;
        }
    }

    async createTeacher(teacherData, schoolId) {
        let createdUser = null;
        try {
            const { email, password, firstName, lastName, subjects, mainClassroomId, classroomIds, schoolId } = teacherData;

            // First verify school exists
            const { data: school, error: schoolError } = await supabaseAdmin
                .from('schools')
                .select('id, name, admin_id')
                .eq('id', schoolId)
                .single();

            if (schoolError) {
                logger.error('School lookup error:', schoolError);
                throw new Error('Error looking up school');
            }
            if (!school) {
                throw new Error(`School not found with ID ${schoolId}`);
            }
            logger.info('Found school:', school);

            // Create teacher user in Supabase Auth
            const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                options: {
                    data: {
                        role: 'teacher',
                        firstName,
                        lastName
                    }
                }
            });

            if (error) throw error;
            createdUser = user;

            // Create teacher role entry
            const { error: roleError } = await supabaseAdmin
                .from('user_roles')
                .insert([{
                    user_id: user.id,
                    role: 'teacher',
                    is_active: true
                }]);

            if (roleError) {
                // Cleanup auth user if role creation fails
                await supabaseAdmin.auth.admin.deleteUser(user.id);
                throw roleError;
            }

            // Create teacher profile with mainClassroomId
            const { error: teacherError, data: teacherProfile } = await supabaseAdmin
                .from('teachers')
                .insert([{
                    user_id: user.id,
                    school_id: school.id, // Use the actual school.id from the lookup
                    first_name: firstName,
                    last_name: lastName,
                    subjects: subjects || [],
                    main_classroom_id: mainClassroomId || null,
                    is_active: true
                }])
                .select()
                .single();

            logger.info('Teacher insert attempt:', { user_id: user.id, school_id: school.id });

            if (teacherError) {
                // Cleanup auth user and role if profile creation fails
                await supabaseAdmin.auth.admin.deleteUser(user.id);
                throw teacherError;
            }

            // Assign teacher to classrooms (including main)
            if (Array.isArray(classroomIds) && classroomIds.length > 0) {
                const teacherClassroomRows = classroomIds.map(cid => ({
                    teacher_id: teacherProfile.id,
                    classroom_id: cid
                }));
                await supabaseAdmin
                    .from('teacher_classrooms')
                    .insert(teacherClassroomRows);
            }

            return {
                message: 'Teacher created successfully',
                user: {
                    id: user.id,
                    email: user.email,
                    role: 'teacher',
                    firstName,
                    lastName,
                    schoolId,
                    schoolName: school.name,
                    mainClassroomId: mainClassroomId || null,
                    classroomIds: classroomIds || []
                }
            };
        } catch (error) {
            // If we created a user but something else failed, clean it up
            if (createdUser) {
                try {
                    await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
                } catch (cleanupError) {
                    logger.error('Failed to cleanup user after error:', cleanupError);
                }
            }
            logger.error('Create teacher error:', error);
            throw error;
        }
    }

    async createStudent(studentData, schoolId) {
        let createdUser = null;
        try {
            const { email, password, firstName, lastName, grade, classSection, classroomId, schoolId } = studentData;

            // Create student user in Supabase Auth
            const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                options: {
                    data: {
                        role: 'student',
                        firstName,
                        lastName
                    }
                }
            });

            if (error) throw error;
            createdUser = user;

            // Create student role entry
            const { error: roleError } = await supabaseAdmin
                .from('user_roles')
                .insert([{
                    user_id: user.id,
                    role: 'student',
                    is_active: true
                }]);

            if (roleError) {
                await supabaseAdmin.auth.admin.deleteUser(user.id);
                throw roleError;
            }

            // Create student profile
            const studentInsert = {
                user_id: user.id,
                school_id: schoolId,
                first_name: firstName,
                last_name: lastName,
                grade,
                class_section: classSection,
                is_active: true
            };

            console.log("yy=>", classroomId)

            // Only add classroom_id if it's provided and valid
            if (classroomId) {
                // Verify classroom exists and belongs to the school
                const { data: classroom, error: classroomError } = await supabaseAdmin
                    .from('classrooms')
                    .select('id')
                    .eq('id', classroomId)
                    .eq('school_id', schoolId)
                    .single();

                if (classroomError || !classroom) {
                    await supabaseAdmin.auth.admin.deleteUser(user.id);
                    throw new Error('Invalid classroom ID or classroom does not belong to this school');
                }
                console.log("Xx=>", classroomId)
                studentInsert["classroom_id"] = classroomId;
            }

            // Insert student profile and get the created record
            const { data: createdStudent, error: studentError } = await supabaseAdmin
                .from('students')
                .insert([studentInsert])
                .select()
                .single();

            if (studentError || !createdStudent) {
                await supabaseAdmin.auth.admin.deleteUser(user.id);
                throw studentError || new Error('Failed to create student profile');
            }

            return {
                message: 'Student created successfully',
                user: {
                    id: user.id,
                    email: user.email,
                    role: 'student',
                    firstName,
                    lastName,
                    grade,
                    classSection,
                    schoolId: schoolId
                },
                student: {
                    id: createdStudent.id,
                    classroomId: createdStudent.classroom_id
                }
            };
        } catch (error) {
            // If we created a user but something else failed, clean it up
            if (createdUser) {
                try {
                    await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
                } catch (cleanupError) {
                    logger.error('Failed to cleanup user after error:', cleanupError);
                }
            }
            logger.error('Create student error:', error);
            throw error;
        }
    }

    async listUsers(role, schoolId) {
        try {
            if (role === 'teacher') {
                // Fetch all teachers for the school
                const { data: teachers, error } = await supabase
                    .from('teachers')
                    .select('*')
                    .eq('school_id', schoolId)
                    .eq('is_active', true);

                if (error) throw error;

                // For each teacher, fetch classroomIds from teacher_classrooms
                const teacherIds = teachers.map(t => t.id);
                let classroomMap = {};
                if (teacherIds.length > 0) {
                    const { data: teacherClassrooms } = await supabase
                        .from('teacher_classrooms')
                        .select('teacher_id, classroom_id')
                        .in('teacher_id', teacherIds);
                    // Map teacher_id to array of classroom_ids
                    classroomMap = teacherClassrooms.reduce((acc, tc) => {
                        if (!acc[tc.teacher_id]) acc[tc.teacher_id] = [];
                        acc[tc.teacher_id].push(tc.classroom_id);
                        return acc;
                    }, {});
                }

                // Return teachers with mainClassroomId and classroomIds
                return teachers.map(t => ({
                    id: t.id,
                    userId: t.user_id,
                    schoolId: t.school_id,
                    firstName: t.first_name,
                    lastName: t.last_name,
                    subjects: t.subjects,
                    isActive: t.is_active,
                    createdAt: t.created_at,
                    updatedAt: t.updated_at,
                    mainClassroomId: t.main_classroom_id || null,
                    classroomIds: classroomMap[t.id] || []
                }));
            } else {
                // Default for students
                let query = supabase
                    .from('students')
                    .select(`
                        *,
                        user_roles!inner(role)
                    `)
                    .eq('school_id', schoolId)
                    .eq('is_active', true);

                const { data, error } = await query;

                if (error) throw error;

                return data;
            }
        } catch (error) {
            logger.error(`List ${role}s error:`, error);
            throw error;
        }
    }

    async createClassroom(classroomData, user) {
        try {
            const { schoolId, name, description } = classroomData;
            
            // Only allow creation if user is admin or teacher in the school
            if (user.role !== 'admin' && user.role !== 'teacher') {
                throw new Error('Only admin or teacher can create classrooms');
            }

            // Check school exists
            const { data: school, error: schoolError } = await supabaseAdmin
                .from('schools')
                .select('id')
                .eq('id', schoolId)
                .single();
            
            if (schoolError || !school) {
                throw new Error('School not found');
            }

            // Determine created_by based on user role
            let createdBy = null;
            
            if (user.role === 'teacher') {
                // For teachers, get their teacher ID
                const { data: teacher, error: teacherError } = await supabaseAdmin
                    .from('teachers')
                    .select('id')
                    .eq('user_id', user.id)
                    .single();
                
                if (teacherError || !teacher) {
                    throw new Error('Teacher profile not found');
                }
                createdBy = teacher.id;
            } else if (user.role === 'admin' && classroomData.createdBy) {
                // For admins, verify teacher if provided
                const { data: teacher, error: teacherError } = await supabaseAdmin
                    .from('teachers')
                    .select('id')
                    .eq('id', classroomData.createdBy)
                    .eq('school_id', schoolId)
                    .single();
                
                if (teacherError || !teacher) {
                    throw new Error('Specified teacher not found or does not belong to this school');
                }
                createdBy = teacher.id;
            }

            // Prepare classroom data
            const classroomInsert = {
                school_id: schoolId,
                name,
                description,
                is_active: true
            };

            // Only add created_by if we have a value
            if (createdBy) {
                classroomInsert.created_by = createdBy;
            }

            // Create the classroom
            const { data, error } = await supabaseAdmin
                .from('classrooms')
                .insert([classroomInsert])
                .select()
                .single();

            if (error) throw error;
            
            return {
                message: 'Classroom created successfully',
                classroom: {
                    id: data.id,
                    schoolId: data.school_id,
                    name: data.name,
                    description: data.description,
                    createdBy: data.created_by,
                    isActive: data.is_active,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at
                }
            };
        } catch (error) {
            logger.error('Create classroom error:', error);
            throw error;
        }
    }
}

module.exports = new UserManagementService(); 