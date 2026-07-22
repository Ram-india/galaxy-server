import Blog, {
  BLOG_STATUS,
  BLOG_CATEGORIES,
  estimateReadingMinutes,
} from "../models/Blog.js";
import cloudinary from "../config/cloudinary.js";
import { readUploadedImage } from "../middleware/imageUpload.js";

/** Escapes user input before it is used inside a regex. */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Shape sent to the public website — no drafts, no internal fields. */
const toPublicPayload = (blog) => ({
  id: blog._id,
  title: blog.title,
  slug: blog.slug,
  excerpt: blog.excerpt,
  content: blog.content,
  coverImage: blog.coverImage?.url || "",
  category: blog.category,
  tags: blog.tags || [],
  publishedAt: blog.publishedAt,
  readingMinutes: blog.readingMinutes,
  views: blog.views,
  author: blog.author?.name || null,
  seo: blog.seo || {},
});

/** Tags arrive as JSON, a repeated field, or a comma-separated string. */
const parseTags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((tag) => String(tag).trim()).filter(Boolean);

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag).trim()).filter(Boolean);
    }
  } catch {
    // Not JSON — fall through to comma splitting
  }

  return String(raw)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

/* ------------------------------------------------------------------ public */

/**
 * GET /api/blogs/public
 * Query: page, limit, category, tag, search
 */
export const getPublicBlogs = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 9));

    const query = { status: BLOG_STATUS.PUBLISHED };

    if (req.query.category && req.query.category !== "all") {
      query.category = req.query.category;
    }

    if (req.query.tag) query.tags = req.query.tag;

    if (req.query.search) {
      const safe = escapeRegex(req.query.search);
      query.$or = [
        { title: { $regex: safe, $options: "i" } },
        { excerpt: { $regex: safe, $options: "i" } },
      ];
    }

    const [posts, total] = await Promise.all([
      Blog.find(query)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("author", "name"),
      Blog.countDocuments(query),
    ]);

    res.status(200).json({
      posts: posts.map(toPublicPayload),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      categories: BLOG_CATEGORIES,
    });
  } catch (error) {
    console.error("Get Public Blogs Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/blogs/public/:slug
 * Returns the post plus a few related ones for the "keep reading" section.
 */
export const getPublicBlog = async (req, res) => {
  try {
    const blog = await Blog.findOne({
      slug: req.params.slug,
      status: BLOG_STATUS.PUBLISHED,
    }).populate("author", "name");

    if (!blog) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Fire-and-forget: a failed counter must not break the page
    Blog.updateOne({ _id: blog._id }, { $inc: { views: 1 } }).catch((error) =>
      console.error("View counter failed:", error)
    );

    const related = await Blog.find({
      _id: { $ne: blog._id },
      status: BLOG_STATUS.PUBLISHED,
      category: blog.category,
    })
      .sort({ publishedAt: -1 })
      .limit(3)
      .populate("author", "name");

    res.status(200).json({
      post: toPublicPayload(blog),
      related: related.map(toPublicPayload),
    });
  } catch (error) {
    console.error("Get Public Blog Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ------------------------------------------------------------------- admin */

/** GET /api/blogs — every status, for the admin list. */
export const getBlogs = async (req, res) => {
  try {
    const { search, category, status } = req.query;

    const query = {};
    if (category && category !== "all") query.category = category;
    if (status && status !== "all") query.status = status;

    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        { title: { $regex: safe, $options: "i" } },
        { excerpt: { $regex: safe, $options: "i" } },
      ];
    }

    const blogs = await Blog.find(query)
      .sort({ updatedAt: -1 })
      .populate("author", "name");

    const stats = {
      total: await Blog.estimatedDocumentCount(),
      published: await Blog.countDocuments({ status: BLOG_STATUS.PUBLISHED }),
      draft: await Blog.countDocuments({ status: BLOG_STATUS.DRAFT }),
      archived: await Blog.countDocuments({ status: BLOG_STATUS.ARCHIVED }),
    };

    res.status(200).json({ blogs, stats, categories: BLOG_CATEGORIES });
  } catch (error) {
    console.error("Get Blogs Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** GET /api/blogs/:id */
export const getBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate("author", "name");

    if (!blog) return res.status(404).json({ message: "Post not found" });

    res.status(200).json(blog);
  } catch (error) {
    console.error("Get Blog Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** POST /api/blogs */
export const createBlog = async (req, res) => {
  try {
    const { title, excerpt, content, category, status, metaTitle, metaDescription } =
      req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: "A title is required." });
    }

    // Publishing needs a body; a draft may be empty
    if (status === BLOG_STATUS.PUBLISHED && !content?.trim()) {
      return res
        .status(400)
        .json({ message: "Add some content before publishing." });
    }

    const blog = await Blog.create({
      title: title.trim(),
      slug: req.body.slug?.trim()
        ? await Blog.generateUniqueSlug(req.body.slug)
        : await Blog.generateUniqueSlug(title),
      excerpt: excerpt || "",
      content: content || "",
      category: BLOG_CATEGORIES.includes(category) ? category : undefined,
      tags: parseTags(req.body.tags),
      status: Object.values(BLOG_STATUS).includes(status)
        ? status
        : BLOG_STATUS.DRAFT,
      publishedAt: status === BLOG_STATUS.PUBLISHED ? new Date() : null,
      coverImage: req.file ? readUploadedImage(req.file) : undefined,
      author: req.admin.id,
      readingMinutes: estimateReadingMinutes(content),
      seo: { metaTitle: metaTitle || "", metaDescription: metaDescription || "" },
    });

    // Fan out to social when the post is created already published.
    // Never awaited for its result beyond logging — a social outage must not
    // fail the write that just succeeded.
    if (blog.status === BLOG_STATUS.PUBLISHED) {
      await shareOnPublish(blog, req.admin.id);
    }

    res.status(201).json({ message: "Post created", blog });
  } catch (error) {
    console.error("Create Blog Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PUT /api/blogs/:id */
export const updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Post not found" });

    const { title, excerpt, content, category, status, metaTitle, metaDescription } =
      req.body;

    if (status === BLOG_STATUS.PUBLISHED && !(content ?? blog.content)?.trim()) {
      return res
        .status(400)
        .json({ message: "Add some content before publishing." });
    }

    // Re-slug only on an explicit request, so published URLs stay stable
    if (req.body.slug?.trim() && req.body.slug.trim() !== blog.slug) {
      blog.slug = await Blog.generateUniqueSlug(req.body.slug, blog._id);
    }

    if (title !== undefined) blog.title = title.trim();
    if (excerpt !== undefined) blog.excerpt = excerpt;
    if (metaTitle !== undefined) blog.seo.metaTitle = metaTitle;
    if (metaDescription !== undefined) blog.seo.metaDescription = metaDescription;
    if (req.body.tags !== undefined) blog.tags = parseTags(req.body.tags);

    if (category !== undefined && BLOG_CATEGORIES.includes(category)) {
      blog.category = category;
    }

    if (content !== undefined) {
      blog.content = content;
      blog.readingMinutes = estimateReadingMinutes(content);
    }

    const wasPublished = blog.status === BLOG_STATUS.PUBLISHED;

    if (status !== undefined && Object.values(BLOG_STATUS).includes(status)) {
      // publishedAt is stamped once and preserved, so re-publishing an old
      // post does not reorder it to the top of the feed.
      if (status === BLOG_STATUS.PUBLISHED && !blog.publishedAt) {
        blog.publishedAt = new Date();
      }
      blog.status = status;
    }

    if (req.file) {
      const previousPublicId = blog.coverImage?.publicId;
      blog.coverImage = readUploadedImage(req.file);

      if (previousPublicId && previousPublicId !== blog.coverImage.publicId) {
        // Best effort: cleanup must not fail the save
        cloudinary.v2.uploader
          .destroy(previousPublicId)
          .catch((error) => console.error("Cover cleanup failed:", error));
      }
    }

    await blog.save();

    // Only on the transition into published — editing a live post must not
    // re-post it to social every time it is saved.
    if (!wasPublished && blog.status === BLOG_STATUS.PUBLISHED) {
      await shareOnPublish(blog, req.admin.id);
    }

    res.status(200).json({ message: "Post updated", blog });
  } catch (error) {
    console.error("Update Blog Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** PATCH /api/blogs/:id/status — publish, unpublish or archive. */
export const updateBlogStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!Object.values(BLOG_STATUS).includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: "Post not found" });

    const wasPublished = blog.status === BLOG_STATUS.PUBLISHED;

    if (status === BLOG_STATUS.PUBLISHED) {
      if (!blog.content?.trim()) {
        return res
          .status(400)
          .json({ message: "Add some content before publishing." });
      }
      if (!blog.publishedAt) blog.publishedAt = new Date();
    }

    blog.status = status;
    await blog.save();

    if (!wasPublished && status === BLOG_STATUS.PUBLISHED) {
      await shareOnPublish(blog, req.admin.id);
    }

    res.status(200).json({
      message:
        status === BLOG_STATUS.PUBLISHED
          ? "Post published — it is now live on the website."
          : `Post moved to ${status}.`,
      blog,
    });
  } catch (error) {
    console.error("Update Blog Status Error:", error);
    res.status(500).json({ message: error.message });
  }
};

/** DELETE /api/blogs/:id */
export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ message: "Post not found" });

    if (blog.coverImage?.publicId) {
      cloudinary.v2.uploader
        .destroy(blog.coverImage.publicId)
        .catch((error) => console.error("Cover cleanup failed:", error));
    }

    res.status(200).json({ success: true, message: "Post deleted" });
  } catch (error) {
    console.error("Delete Blog Error:", error);
    res.status(500).json({ message: error.message });
  }
};
