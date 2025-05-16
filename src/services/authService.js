const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const userManagementService = require('./userManagementService');

class AuthService {
    validateInput(email, password) {
        const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }
    }

    async login(email, password) {
        try {
            this.validateInput(email, password);

            // Use the public client for user sign-in
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                // If email not confirmed, throw the error (do not try to auto-confirm)
                if (error.message === 'Email not confirmed') {
                    throw error;
                } else {
                    throw error;
                }
            }

            if (!data?.user) throw new Error('Failed to get user data');

            // Get user role from custom table
            const { data: userData, error: roleError } = await supabase
                .from('user_roles')
                .select('role, is_active')
                .eq('user_id', data.user.id)
                .single();

            if (roleError) throw roleError;

            // Check if account is active
            if (!userData.is_active) {
                throw new Error('Account is inactive. Please contact support.');
            }

            // Get additional profile data based on role
            let profileData = {};
            if (userData.role === 'admin') {
                const { data: schoolData } = await supabase
                    .from('schools')
                    .select('id, name')
                    .eq('admin_id', data.user.id)
                    .single();
                profileData = { schoolId: schoolData?.id, schoolName: schoolData?.name };
            } else {
                const table = userData.role === 'teacher' ? 'teachers' : 'students';
                const { data: profile } = await supabaseAdmin
                    .from(table)
                    .select('school_id, first_name, last_name')
                    .eq('user_id', data.user.id)
                    .single();
                profileData = {
                    schoolId: profile?.school_id,
                    firstName: profile?.first_name,
                    lastName: profile?.last_name
                };
            }

            return this.processUserData(data.user, userData, profileData);
        } catch (error) {
            logger.error('Login error:', error);
            throw error;
        }
    }

    processUserData(user, userData, profileData) {
        console.log("user.school_id", profileData.schoolId)
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: userData.role,
                schoolId: profileData.schoolId,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        return {
            user: {
                id: user.id,
                email: user.email,
                role: userData.role
            },
            token
        };
    }

    // This method now redirects to the appropriate user management service method
    async register(userData) {
        try {
            this.validateInput(userData.email, userData.password);

            switch (userData.role) {
                case 'admin':
                    return await userManagementService.createSchool({
                        email: userData.email,
                        password: userData.password,
                        schoolName: userData.schoolName || 'New School',
                        address: userData.address,
                        contactNumber: userData.contactNumber
                    });

                // case 'teacher':
                //     if (!userData.schoolId) {
                //         throw new Error('School ID is required for teacher registration');
                //     }
                //     return await userManagementService.createTeacher({
                //         email: userData.email,
                //         password: userData.password,
                //         firstName: userData.firstName,
                //         lastName: userData.lastName,
                //         subjects: userData.subjects
                //     }, userData.schoolId);

                // case 'student':
                //     if (!userData.schoolId) {
                //         throw new Error('School ID is required for student registration');
                //     }
                //     return await userManagementService.createStudent({
                //         email: userData.email,
                //         password: userData.password,
                //         firstName: userData.firstName,
                //         lastName: userData.lastName,
                //         grade: userData.grade,
                //         classSection: userData.classSection
                //     }, userData.schoolId);

                default:
                    throw new Error('Invalid role specified');
            }
        } catch (error) {
            logger.error('Registration error:', error);
            throw error;
        }
    }
}

module.exports = new AuthService(); 