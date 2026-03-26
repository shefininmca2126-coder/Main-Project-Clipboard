-- AI Based Cross Platform Clipboard System - Database Schema
-- Run this after creating the database: CREATE DATABASE smart_question_system;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS otp_verifications;
DROP TABLE IF EXISTS submissions;
DROP TABLE IF EXISTS exam_sessions;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS question_sets;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS batches;

SET FOREIGN_KEY_CHECKS = 1;

-- Batches: one row per batch name
CREATE TABLE batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_batches_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Users: students, teachers and admins (role distinguishes)
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role ENUM('student', 'teacher', 'admin') NOT NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  batch_id INT NULL,
  roll_number VARCHAR(64) NULL,
  department VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_email (email),
  KEY idx_users_batch_id (batch_id),
  KEY idx_users_role (role),
  CONSTRAINT fk_users_batch FOREIGN KEY (batch_id) REFERENCES batches (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Question sets: belong to a batch, created by a teacher
CREATE TABLE question_sets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  batch_id INT NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_question_sets_batch_id (batch_id),
  KEY idx_question_sets_created_by (created_by),
  CONSTRAINT fk_question_sets_batch FOREIGN KEY (batch_id) REFERENCES batches (id) ON DELETE CASCADE,
  CONSTRAINT fk_question_sets_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Questions: belong to a question set
CREATE TABLE questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_set_id INT NOT NULL,
  question_text TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_questions_question_set_id (question_set_id),
  CONSTRAINT fk_questions_question_set FOREIGN KEY (question_set_id) REFERENCES question_sets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Assignments: which student has which question set (one per student per batch)
CREATE TABLE assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  batch_id INT NOT NULL,
  question_set_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_assignments_student_batch (student_id, batch_id),
  KEY idx_assignments_student_id (student_id),
  KEY idx_assignments_question_set_id (question_set_id),
  CONSTRAINT fk_assignments_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_batch FOREIGN KEY (batch_id) REFERENCES batches (id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_question_set FOREIGN KEY (question_set_id) REFERENCES question_sets (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Teacher batches: which batches a teacher is responsible for
CREATE TABLE teacher_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT NOT NULL,
  batch_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_teacher_batches_teacher_batch (teacher_id, batch_id),
  KEY idx_teacher_batches_teacher_id (teacher_id),
  KEY idx_teacher_batches_batch_id (batch_id),
  CONSTRAINT fk_teacher_batches_teacher FOREIGN KEY (teacher_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_teacher_batches_batch FOREIGN KEY (batch_id) REFERENCES batches (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exam sessions: timed exams per batch and question set
CREATE TABLE exam_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  batch_id INT NOT NULL,
  question_set_id INT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  status ENUM('scheduled', 'running', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_exam_sessions_batch_id (batch_id),
  KEY idx_exam_sessions_question_set_id (question_set_id),
  KEY idx_exam_sessions_status (status),
  CONSTRAINT fk_exam_sessions_batch FOREIGN KEY (batch_id) REFERENCES batches (id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_sessions_question_set FOREIGN KEY (question_set_id) REFERENCES question_sets (id) ON DELETE CASCADE,
  CONSTRAINT fk_exam_sessions_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Submissions: clipboard paste events (image path + OCR text)
CREATE TABLE submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  image_path VARCHAR(512) NOT NULL,
  extracted_text TEXT NULL,
  question_set_id INT NULL,
  exam_session_id INT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_submissions_student_id (student_id),
  KEY idx_submissions_submitted_at (submitted_at),
  KEY idx_submissions_question_set_id (question_set_id),
  KEY idx_submissions_exam_session_id (exam_session_id),
  CONSTRAINT fk_submissions_student FOREIGN KEY (student_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_submissions_question_set FOREIGN KEY (question_set_id) REFERENCES question_sets (id) ON DELETE SET NULL,
  CONSTRAINT fk_submissions_exam_session FOREIGN KEY (exam_session_id) REFERENCES exam_sessions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- OTP verifications: for email verification at registration
CREATE TABLE otp_verifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  otp_code VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_otp_user_id (user_id),
  KEY idx_otp_expires_at (expires_at),
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
