import Project from '../models/Projects.js'
// CREATE PROJECT API

export const createProject = async (req, res) => {
    try {
        const {
            projectName,
            clientName,
            capacity,
            location,
            projectType,
            status,
            description,
            startDate,
            completionDate
        } = req.body;
       
        const project = await Project.create({
            projectName,
            clientName,
            capacity,
            location,
            projectType,
            status,
            description,
            startDate,
            completionDate
        });
        res.status(201).json({
            message: "Project created successfully",
            project
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};
// GET ALL PROJECTS
export const getProjects = async (req, res) => {
    try {
        const projects = await Project.find()
            .sort({ createdAt: -1 });
        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};
// GET SINGLE PROJECT
export const getProject = async (req, res) => {
    try {
        const project = await Project.findById(
            req.params.id
        );
        if (!project) {
            return res.status(404).json({
                message: "Project  not found"
            });
        }
        res.status(200).json(project);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

//UPDATE PROJECT

export const updateProject = async (req, res) => {
    try {
        const project = await Project.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!project) {
            return res.status(404).json({
                message: "Project  not found"
            });
        }
        res.status(200).json(project);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};
// DELETE PROJECT

export const deleteProject = async (req, res) => {
    try {
        const project = await Project.findByIdAndDelete(
            req.params.id
        );
        if (!project) {
            return res.status(404).json({
                message: "Project  not found"
            });
        }
        res.status(200).json({
            message: "project deleted"
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};