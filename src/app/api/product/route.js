import { NextResponse } from 'next/server';
import { Product, Category, Discount } from '@/models';
import { sequelize } from '@/lib/db';
import { Op } from 'sequelize';
import { getSellerFromToken } from '@/lib/get-seller-from-token';

// GET: Fetch all products for the authenticated seller
export async function GET(req) {
  const seller = await getSellerFromToken(req);
  if (!seller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const products = await Product.findAll({
      where: { sellerId: seller.sellerId }, // DATA ISOLATION
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }], // Include category ID as well
      order: [['createdAt', 'DESC']],
    });
    return NextResponse.json(products);
  } catch (err) {
    console.error('[PRODUCTS_GET_ERROR]', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST: Create a new product for the authenticated seller
export async function POST(req) {
  const seller = await getSellerFromToken(req);
  if (!seller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json(); // Expecting JSON body, not FormData
    const { name, slug, categoryId, pricePerKg, pricePerUnit, unitLabel, image, description, isAvailable } = body;

    if (!name || !slug || !categoryId) {
      return NextResponse.json({ error: 'Missing required fields: name, slug, or categoryId.' }, { status: 400 });
    }

    const newProduct = await Product.create({
      name,
      slug,
      categoryId,
      pricePerKg: pricePerKg || null,
      pricePerUnit: pricePerUnit || null,
      unitLabel: unitLabel || null,
      image: image || null, // Image path/URL
      description: description || null,
      isAvailable: isAvailable ?? true,
      sellerId: seller.sellerId, // DATA ISOLATION: Assign product to the seller
    });

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('POST /api/product error:', error);
    // Handle potential unique constraint error for the slug
    if (error.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json({ error: 'Product slug must be unique.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update an existing product owned by the authenticated seller
export async function PUT(req) {
  const seller = await getSellerFromToken(req);
  if (!seller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json(); // Expecting JSON body, not FormData
    const { id, name, slug, categoryId, pricePerKg, pricePerUnit, unitLabel, image, description, isAvailable } = body;

    if (!id) {
        return NextResponse.json({ error: 'Product ID is required for update.' }, { status: 400 });
    }
    if (!name || !slug || !categoryId) {
        return NextResponse.json({ error: 'Missing required fields for update: name, slug, or categoryId.' }, { status: 400 });
    }

    // DATA ISOLATION: Find the product by its ID AND the seller's ID
    const product = await Product.findOne({
      where: { id, sellerId: seller.sellerId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found or you do not have permission to edit it.' }, { status: 404 });
    }

    await product.update({
        name,
        slug,
        categoryId,
        pricePerKg: pricePerKg || null,
        pricePerUnit: pricePerUnit || null,
        unitLabel: unitLabel || null,
        image: image || null, // Image path/URL
        description: description || null,
        isAvailable: isAvailable ?? true,
    });
    return NextResponse.json(product);
  } catch (error) {
    console.error('PUT /api/product error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
        return NextResponse.json({ error: 'Product slug must be unique.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete a product owned by the authenticated seller
export async function DELETE(req) {
  const seller = await getSellerFromToken(req);
  if (!seller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Product ID is required for deletion.' }, { status: 400 });
    }

    // DATA ISOLATION: Ensure the product being deleted belongs to the seller
    const product = await Product.findOne({
      where: { id, sellerId: seller.sellerId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found or you do not have permission to delete it.' }, { status: 404 });
    }

    await product.destroy();
    return NextResponse.json({ message: 'Product deleted successfully.' });
  } catch (error) {
    console.error('DELETE /api/product error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
