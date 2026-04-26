const Template = require('../models/Template');

const ADMIN_EMAILS = ['your.email@gmail.com', 'admin@rajchavin.com']; 

exports.createTemplate = async (req, res) => {
  try {
    // The protect middleware should attach the user to req.user
    if (!req.user || !ADMIN_EMAILS.includes(req.user.email)) {
      return res.status(403).json({ message: "Security Error: Your email is not authorized to publish global templates." });
    }

    const template = new Template({
      ...req.body,
      createdBy: req.user.email
    });

    await template.save();
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/templates/:id
exports.updateTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    // Gatekeeper: Only the creator (or a hardcoded master admin) can edit
    if (template.createdBy !== req.user.email && !ADMIN_EMAILS.includes(req.user.email)) {
      return res.status(403).json({ message: 'Not authorized to edit this template' });
    }

    const updatedTemplate = await Template.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedTemplate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   DELETE /api/templates/:id
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    // Gatekeeper: Only the creator (or a hardcoded master admin) can delete
    if (template.createdBy !== req.user.email && !ADMIN_EMAILS.includes(req.user.email)) {
      return res.status(403).json({ message: 'Not authorized to delete this template' });
    }

    await template.remove();
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};