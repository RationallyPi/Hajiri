export interface Student {
    studentID: number;
    departmentID: number;
    name: string;
    rollNumber: number;
    photo: string;
}

export interface Department {
    departmentID: number;
    name: string;
}

export interface Session {
    sessionID: number;
    departmentID: number;
    date: Date;
    finished: boolean;
}

export interface Attendance {
    sessionID: number;
    studentID: number;
    status: boolean;
}